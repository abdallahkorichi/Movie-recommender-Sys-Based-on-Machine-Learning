"""
retrain.py — incremental retrain pipeline

Called by the scheduler weekly (or triggered manually).
Merges MongoDB interactions with the original MovieLens ratings,
retrains ALS + rebuilds alignment, hot-swaps the running API model
without restarting the server, and logs metrics to MongoDB.

Usage:
    python retrain.py                  # full retrain
    python retrain.py --dry-run        # check new interaction count only
    python retrain.py --min-new 1000   # skip if fewer than 1000 new interactions
"""

import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import sys
import time
import argparse
import pickle
import shutil
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))         # makes "from db.mongo" work
sys.path.insert(0, str(Path(__file__).parent.parent))  # makes "from src.x" work

from src.data_loader import load_ratings, load_movies, load_tags
from src.preprocessing import build_movie_content, convert_to_implicit, get_popular_movies
from src.collab_model import build_interaction_matrix, train_als, save_collab_artifacts
from src.content_model import load_content_artifacts          # embeddings never retrain
from src.hybrid import build_alignment_map, validate_alignment
from db.mongo import (
    get_all_interactions_as_dataframe,
    log_retrain,
    get_retrain_history,
    interaction_count_since,
)

ARTIFACT_PATH   = Path("artifacts")
ARTIFACT_BACKUP = Path("artifacts_backup")


def merge_ratings(movielens_ratings: pd.DataFrame, mongo_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge original MovieLens ratings with new MongoDB interactions.

    New interactions take precedence — if a user rated a movie in both
    sources, the MongoDB rating (more recent) wins.
    """
    if mongo_df.empty:
        print("[retrain] No MongoDB interactions found — training on MovieLens only.")
        return movielens_ratings

    # Tag sources
    movielens_ratings = movielens_ratings.copy()
    mongo_df = mongo_df.copy()

    # MongoDB users might use a different userId range than MovieLens
    # (e.g. your app creates new user accounts). We offset MongoDB userIds
    # to avoid collisions with MovieLens userIds (max MovieLens userId ~138493)
    MONGO_USER_OFFSET = 200_000
    mongo_df["userId"] = mongo_df["userId"] + MONGO_USER_OFFSET

    # Convert timestamps to datetime BEFORE merging so pandas doesn't coerce ints to NaT
    movielens_ratings["timestamp"] = pd.to_datetime(movielens_ratings["timestamp"], utc=True, errors="coerce")
    mongo_df["timestamp"] = pd.to_datetime(mongo_df["timestamp"], unit="s", utc=True, errors="coerce")

    combined = pd.concat([movielens_ratings, mongo_df], ignore_index=True)
    
    # Force numeric IDs and rating
    for col in ["userId", "movieId", "rating"]:
        combined[col] = pd.to_numeric(combined[col], errors="coerce")
    
    # Drop any genuine corruptions
    initial_len = len(combined)
    combined = combined.dropna(subset=["userId", "movieId", "timestamp", "rating"])
    if len(combined) < initial_len:
        print(f"[retrain] WARNING: Dropped {initial_len - len(combined):,} actually corrupt rows.")

    # Convert everything to standard ML-compatible types
    combined["userId"] = combined["userId"].astype(np.int64)
    combined["movieId"] = combined["movieId"].astype(np.int64)
    combined["timestamp"] = (combined["timestamp"].dt.tz_localize(None).astype('int64') // 10**9)

    # If same user+movie appears twice, keep the most recent rating
    combined = (
        combined
        .sort_values("timestamp")
        .drop_duplicates(subset=["userId", "movieId"], keep="last")
        .reset_index(drop=True)
    )

    new_users  = mongo_df["userId"].nunique()
    new_events = len(mongo_df)
    print(f"[retrain] MongoDB interactions : {new_events:,} from {new_users:,} new users")
    print(f"[retrain] Combined interactions: {len(combined):,}")
    return combined


def backup_artifacts():
    """Copy current artifacts to backup before overwriting."""
    if ARTIFACT_PATH.exists():
        if ARTIFACT_BACKUP.exists():
            shutil.rmtree(ARTIFACT_BACKUP)
        shutil.copytree(ARTIFACT_PATH, ARTIFACT_BACKUP)
        print(f"[retrain] Artifacts backed up to {ARTIFACT_BACKUP}/")


def restore_backup():
    """Restore backup if retrain failed."""
    if ARTIFACT_BACKUP.exists():
        if ARTIFACT_PATH.exists():
            shutil.rmtree(ARTIFACT_PATH)
        shutil.copytree(ARTIFACT_BACKUP, ARTIFACT_PATH)
        print("[retrain] Backup restored after failed retrain.")


def notify_api_to_reload():
    """
    Write a sentinel file that the API watches for.
    When the API sees this file, it reloads models without restarting.
    """
    sentinel = ARTIFACT_PATH / ".reload_signal"
    sentinel.touch()
    print(f"[retrain] Reload signal written to {sentinel}")


def run_retrain(dry_run: bool = False, min_new: int = 0) -> dict:
    t0 = time.time()

    # Check new interaction count first
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    new_count = interaction_count_since(one_week_ago)
    print(f"[retrain] New interactions in last 7 days: {new_count:,}")

    if dry_run:
        print("[retrain] Dry run — stopping here.")
        return {"new_interactions": new_count}

    if new_count < min_new:
        print(f"[retrain] Only {new_count} new interactions, threshold is {min_new}. Skipping.")
        return {"skipped": True, "new_interactions": new_count}

    print(f"\n[retrain] Starting full retrain at {datetime.now(timezone.utc).isoformat()}")

    # 1. Load data
    print("\n== Step 1: Load data ====================================")
    ml_ratings  = load_ratings()
    movies      = load_movies()
    tags        = load_tags()
    mongo_df    = get_all_interactions_as_dataframe()
    movie_content = build_movie_content(movies, tags)

    # 2. Merge and preprocess
    print("\n== Step 2: Merge + preprocess ===========================")
    all_ratings = merge_ratings(ml_ratings, mongo_df)
    train_ratings = convert_to_implicit(all_ratings)

    # 3. Retrain ALS
    print("\n== Step 3: Retrain ALS ==================================")
    backup_artifacts()
    try:
        (sparse_matrix, user_mapping, movie_mapping,
         inv_user_mapping, inv_movie_mapping) = build_interaction_matrix(train_ratings)
        model = train_als(sparse_matrix)

        # 4. Rebuild alignment (content embeddings never change — save to retrain)
        print("\n== Step 4: Alignment ====================================")
        content_embeddings, faiss_index = load_content_artifacts()
        movieid_to_embed_idx = {
            int(row["movieId"]): i
            for i, row in movie_content.iterrows()
        }
        als_to_embed = build_alignment_map(movie_mapping, movieid_to_embed_idx)
        validate_alignment(
            als_to_embed=als_to_embed,
            movie_mapping=movie_mapping,
            movieid_to_embed_idx=movieid_to_embed_idx,
            content_embeddings=content_embeddings,
            movie_content=movie_content,
            n_spot_checks=5,
        )

        # 5. Save new artifacts
        print("\n== Step 5: Save artifacts ===============================")
        save_collab_artifacts(
            model, sparse_matrix, user_mapping, movie_mapping,
            inv_user_mapping, inv_movie_mapping,
        )

        # Signal the API to hot-reload
        notify_api_to_reload()

        duration = time.time() - t0
        metrics = {
            "n_users":           sparse_matrix.shape[0],
            "n_movies":          sparse_matrix.shape[1],
            "n_interactions":    int(sparse_matrix.nnz),
            "mongo_interactions": int(len(mongo_df)),
            "duration_seconds":  round(duration, 1),
        }

        log_retrain(metrics=metrics, duration_seconds=duration, triggered_by="scheduler")
        print(f"\n[DONE] Retrain complete in {duration:.1f}s")
        print(f"  Users    : {metrics['n_users']:,}")
        print(f"  Movies   : {metrics['n_movies']:,}")
        print(f"  Signals  : {metrics['n_interactions']:,}")
        return metrics

    except Exception as e:
        print(f"\n[retrain] ERROR: {e}")
        restore_backup()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Print new interaction count and exit")
    parser.add_argument("--min-new", type=int, default=0,
                        help="Skip retrain if fewer than N new interactions")
    args = parser.parse_args()
    run_retrain(dry_run=args.dry_run, min_new=args.min_new)