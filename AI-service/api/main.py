"""
api/main.py - FastAPI serving layer

Run after training:
    uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

Endpoints:
    GET  /recommend/{user_id}?k=10&alpha=0.7
    GET  /similar/{movie_id}?k=10
    GET  /movies/search?q=inception
    GET  /movies/{movie_id}
    GET  /popular?n=20
    GET  /health
"""

import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collab_model import load_collab_artifacts, artifacts_exist
from src.content_model import load_content_artifacts, content_artifacts_exist
from src.preprocessing import get_popular_movies, build_movie_content
from src.data_loader import load_movies, load_tags, load_ratings
from src.hybrid import (
    recommend_hybrid,
    recommend_similar_movies,
    build_alignment_map,
    validate_alignment,
)

ARTIFACT_PATH = Path("artifacts")


# App state - loaded once at startup
class AppState:
    model = None
    sparse_matrix = None
    user_mapping = None
    movie_mapping = None
    inv_user_mapping = None
    als_to_embed: dict = {}         # als_item_idx -> embed_idx  (THE alignment map)
    movieid_to_embed_idx: dict = {} # movieId -> embed_idx
    content_embeddings = None
    faiss_index = None
    popular_movies = None
    movie_lookup: dict = {}         # movieId -> {title, genres}
    movie_content = None            # DataFrame, needed for similar movies
    ready: bool = False


state = AppState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    t0 = time.time()
    print("[api] Loading artifacts...")

    if not artifacts_exist() or not content_artifacts_exist():
        print("[api] WARNING: artifacts not found. Run train.py first.")
        yield
        return

    # Load collab artifacts
    (state.model, state.sparse_matrix,
     state.user_mapping, state.movie_mapping,
     state.inv_user_mapping, inv_movie_mapping) = load_collab_artifacts()

    # Load content artifacts
    state.content_embeddings, state.faiss_index = load_content_artifacts()

    # Load raw data
    movies = load_movies()
    tags = load_tags()
    ratings = load_ratings()

    # Build movie content (needed for similar movies)
    state.movie_content = build_movie_content(movies, tags)

    # Build movieId -> embed_idx mapping
    # movie_content rows are in the same order as content_embeddings (both come
    # from the same movie.csv, reset_index in build_movie_content)
    state.movieid_to_embed_idx = {
        int(row["movieId"]): i
        for i, row in state.movie_content.iterrows()
    }

    # Build and validate the alignment map (als_idx -> embed_idx)
    state.als_to_embed = build_alignment_map(
        state.movie_mapping,
        state.movieid_to_embed_idx,
    )

    # Run alignment spot-check - printed to server console
    validate_alignment(
        als_to_embed=state.als_to_embed,
        movie_mapping=state.movie_mapping,
        movieid_to_embed_idx=state.movieid_to_embed_idx,
        content_embeddings=state.content_embeddings,
        movie_content=state.movie_content,
        n_spot_checks=8,
    )

    # Popular movies for cold-start
    state.popular_movies = get_popular_movies(ratings, movies, n=100)

    # Fast title/genre lookup
    state.movie_lookup = {
        int(row["movieId"]): {"title": row["title"], "genres": row["genres"]}
        for _, row in movies.iterrows()
    }

    state.ready = True
    print(f"[api] Ready in {time.time() - t0:.1f}s")
    yield


app = FastAPI(
    title="Movie Recommender API",
    description="Hybrid ALS + content-based movie recommendations",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_ready():
    if not state.ready:
        raise HTTPException(503, "Model not loaded. Run train.py first.")


def enrich_movie(movie_id: int) -> dict:
    info = state.movie_lookup.get(movie_id, {})
    return {
        "movieId": movie_id,
        "title": info.get("title", "Unknown"),
        "genres": info.get("genres", ""),
    }


@app.get("/health")
def health():
    return {
        "status": "ok" if state.ready else "loading",
        "version": "2.0.0",
        "aligned_movies": len(state.als_to_embed),
    }


@app.get("/recommend/{user_id}")
def recommend(
    user_id: int,
    k: int = Query(10, ge=1, le=50),
    alpha: float = Query(0.7, ge=0.0, le=1.0),
):
    """Personalised recommendations. Returns popular movies for unknown users."""
    require_ready()
    t0 = time.time()

    # Shift user ID to avoid collision with ALS matrix users
    MONGO_USER_OFFSET = 200_000
    internal_user_id = user_id + MONGO_USER_OFFSET

    movie_ids = recommend_hybrid(
        user_id=internal_user_id,
        model=state.model,
        sparse_matrix=state.sparse_matrix,
        user_mapping=state.user_mapping,
        movie_mapping=state.movie_mapping,
        inv_user_mapping=state.inv_user_mapping,
        als_to_embed=state.als_to_embed,
        content_embeddings=state.content_embeddings,
        faiss_index=state.faiss_index,
        popular_movies=state.popular_movies,
        top_k=k,
        alpha=alpha,
    )

    return {
        "userId": user_id,
        "cold_start": user_id not in state.inv_user_mapping,
        "recommendations": [enrich_movie(mid) for mid in movie_ids],
        "latency_ms": round((time.time() - t0) * 1000, 1),
    }


@app.get("/similar/{movie_id}")
def similar_movies(
    movie_id: int,
    k: int = Query(10, ge=1, le=50),
):
    """More like this - content-based similar movies."""
    require_ready()

    if movie_id not in state.movie_lookup:
        raise HTTPException(404, f"movieId {movie_id} not found.")

    movie_ids = recommend_similar_movies(
        movie_id=movie_id,
        movieid_to_embed_idx=state.movieid_to_embed_idx,
        content_embeddings=state.content_embeddings,
        movie_content=state.movie_content,
        top_k=k,
    )

    return {
        "movieId": movie_id,
        "source": enrich_movie(movie_id),
        "similar": [enrich_movie(mid) for mid in movie_ids],
    }


# NOTE: /movies/search MUST be declared before /movies/{movie_id}
# so FastAPI doesn't try to parse "search" as an integer movie_id
@app.get("/movies/search")
def search_movies(
    q: str = Query(..., min_length=2),
    limit: int = Query(10, ge=1, le=50),
):
    """Case-insensitive title search."""
    require_ready()
    q_lower = q.lower()
    results = [
        enrich_movie(mid)
        for mid, info in state.movie_lookup.items()
        if q_lower in info.get("title", "").lower()
    ]
    return {"query": q, "results": results[:limit], "total": len(results)}


@app.get("/movies/{movie_id}")
def get_movie(movie_id: int):
    """Single movie metadata."""
    require_ready()
    if movie_id not in state.movie_lookup:
        raise HTTPException(404, f"movieId {movie_id} not found.")
    return enrich_movie(movie_id)


@app.get("/popular")
def popular_movies(n: int = Query(20, ge=1, le=100)):
    """Most popular movies by interaction count."""
    require_ready()
    return {"popular": [enrich_movie(mid) for mid in (state.popular_movies or [])[:n]]}


# ── Feedback + hot-reload ─────────────────────────────────────────────────────

import threading
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).parent))         # adds api/ to path
sys.path.insert(0, str(Path(__file__).parent.parent))  # adds AI-service/ to path
from db.mongo import log_interaction, get_retrain_history, ensure_indexes

RELOAD_SIGNAL = Path("artifacts") / ".reload_signal"


class FeedbackPayload(BaseModel):
    userId: int
    movieId: int
    tmdbId: int = None
    rating: float


@app.post("/feedback")
def feedback(payload: FeedbackPayload):
    """
    Log a user star rating to MongoDB.
    This is the data that feeds the weekly retrain.
    """
    require_ready()

    if payload.rating < 1 or payload.rating > 5:
        raise HTTPException(400, "Rating must be between 1 and 5")

    log_interaction(
        user_id=payload.userId,
        movie_id=payload.movieId,
        tmdb_id=payload.tmdbId,
        rating=payload.rating,
    )
    return {"status": "logged", "rating": payload.rating}


@app.get("/retrain/history")
def retrain_history(n: int = Query(10, ge=1, le=50)):
    """Show the last N retrain runs and their metrics."""
    require_ready()
    return {"history": get_retrain_history(n)}


@app.post("/retrain/trigger")
def trigger_retrain(background_tasks):
    """
    Manually trigger a retrain (admin use only — add auth before exposing).
    Runs in background so the API stays responsive.
    """
    require_ready()

    def _run():
        try:
            from retrain import run_retrain
            run_retrain()
        except Exception as e:
            print(f"[api] Manual retrain failed: {e}")

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"status": "retrain started in background"}


def _watch_for_reload():
    """
    Background thread that watches for the .reload_signal file.
    When retrain.py finishes, it touches artifacts/.reload_signal.
    This thread detects it, reloads the model in-place, and deletes the file.
    Hot-swap with zero downtime — no uvicorn restart needed.
    """
    import time

    while True:
        time.sleep(30)   # check every 30 seconds
        if RELOAD_SIGNAL.exists():
            print("[api] Reload signal detected — hot-swapping model...")
            try:
                from src.collab_model import load_collab_artifacts
                from src.hybrid import build_alignment_map, validate_alignment
                from src.preprocessing import build_movie_content, get_popular_movies
                from src.data_loader import load_movies, load_tags, load_ratings

                (state.model, state.sparse_matrix,
                 state.user_mapping, state.movie_mapping,
                 state.inv_user_mapping, _) = load_collab_artifacts()

                movies = load_movies()
                tags   = load_tags()
                ratings = load_ratings()
                state.movie_content = build_movie_content(movies, tags)

                state.movieid_to_embed_idx = {
                    int(row["movieId"]): i
                    for i, row in state.movie_content.iterrows()
                }
                state.als_to_embed = build_alignment_map(
                    state.movie_mapping, state.movieid_to_embed_idx
                )
                state.popular_movies = get_popular_movies(ratings, movies, n=100)

                RELOAD_SIGNAL.unlink()
                print("[api] Hot-swap complete — serving new model.")
            except Exception as e:
                print(f"[api] Hot-swap failed: {e}")
                RELOAD_SIGNAL.unlink(missing_ok=True)


# Start the reload watcher thread when the module loads
_reload_thread = threading.Thread(target=_watch_for_reload, daemon=True)
_reload_thread.start()