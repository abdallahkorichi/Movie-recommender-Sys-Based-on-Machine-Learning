"""
train.py - full training pipeline

Run from project root:
    python train.py                          # train on all 20M ratings
    python train.py --sample 500000          # subsample for fast dev iteration
    python train.py --evaluate               # train + temporal eval
    python train.py --evaluate --alpha-sweep # eval + find best alpha
    python train.py --force                  # retrain even if artifacts exist
"""

import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"

import argparse
import time

from src.data_loader import load_ratings, load_movies, load_tags
from src.preprocessing import build_movie_content, convert_to_implicit, get_popular_movies
from src.collab_model import (
    build_interaction_matrix, train_als,
    save_collab_artifacts, load_collab_artifacts, artifacts_exist,
)
from src.content_model import (
    train_content_embeddings, build_faiss_index,
    save_content_artifacts, load_content_artifacts, content_artifacts_exist,
)
from src.hybrid import build_alignment_map, validate_alignment
from src.evaluation import evaluate_model, temporal_train_test_split, alpha_sweep


def main(args):
    t0 = time.time()

    # 1. Load data
    print("\n── Step 1: Loading data ─────────────────────────────────")
    ratings_raw = load_ratings()
    movies      = load_movies()
    tags        = load_tags()

    if args.sample:
        print(f"Subsampling to {args.sample:,} ratings for dev mode.")
        ratings_raw = ratings_raw.sample(args.sample, random_state=42)

    # 2. Preprocessing + split
    print("\n── Step 2: Preprocessing ────────────────────────────────")
    movie_content = build_movie_content(movies, tags)

    if args.evaluate:
        # KEY POINT: split BEFORE converting to implicit so both
        # train and test come from the same ratings universe
        train_ratings_raw, test_ratings_raw = temporal_train_test_split(
            ratings_raw, test_fraction=0.1
        )
        # Train: all positive interactions in the training window
        train_ratings = convert_to_implicit(train_ratings_raw)
        # Test: only high-rated movies (>=4) from the test window
        test_ratings = test_ratings_raw[
            test_ratings_raw["rating"] >= 4.0
        ].copy()
        print(f"[train] Test positives (rating>=4): {len(test_ratings):,}")
    else:
        train_ratings = convert_to_implicit(ratings_raw)
        test_ratings  = None

    # 3. Collaborative model
    # IMPORTANT: when evaluating, always retrain on the TRAIN split only.
    # Loading from disk would use a model trained on all data including
    # what we're trying to evaluate on — that's data leakage.
    print("\n── Step 3: Collaborative model ──────────────────────────")
    if args.evaluate:
        print("Evaluation mode — training fresh model on train split "
              "(prevents data leakage from disk artifacts).")
        (sparse_matrix, user_mapping, movie_mapping,
         inv_user_mapping, inv_movie_mapping) = build_interaction_matrix(train_ratings)
        model = train_als(sparse_matrix)
        # Don't save — this is an eval-only model, not for production
    elif not args.force and artifacts_exist():
        print("Collab artifacts found — loading from disk.")
        (model, sparse_matrix, user_mapping, movie_mapping,
         inv_user_mapping, inv_movie_mapping) = load_collab_artifacts()
    else:
        (sparse_matrix, user_mapping, movie_mapping,
         inv_user_mapping, inv_movie_mapping) = build_interaction_matrix(train_ratings)
        model = train_als(sparse_matrix)
        save_collab_artifacts(
            model, sparse_matrix, user_mapping, movie_mapping,
            inv_user_mapping, inv_movie_mapping,
        )

    # 4. Content model (safe to load from disk — no leakage risk,
    # embeddings come from movie metadata not ratings)
    print("\n── Step 4: Content model ────────────────────────────────")
    if not args.force and content_artifacts_exist():
        print("Content artifacts found — loading from disk.")
        content_embeddings, faiss_index = load_content_artifacts()
    else:
        content_embeddings = train_content_embeddings(movie_content)
        faiss_index = build_faiss_index(content_embeddings)
        save_content_artifacts(content_embeddings, faiss_index)

    # 5. Alignment
    print("\n── Step 5: Alignment ────────────────────────────────────")
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

    # 6. Popular movies
    popular_movies = get_popular_movies(train_ratings, movies, n=100)
    print(f"[train] Top 5 popular movieIds: {popular_movies[:5]}")

    # 7. Sanity check before evaluation
    if args.evaluate and test_ratings is not None:
        test_users = set(test_ratings["userId"].unique())
        train_users = set(inv_user_mapping.keys())
        overlap = test_users & train_users
        print(f"\n[sanity] Test users              : {len(test_users):,}")
        print(f"[sanity] Train users             : {len(train_users):,}")
        print(f"[sanity] Overlap (evaluable)     : {len(overlap):,}")
        print(f"[sanity] model.user_factors rows : {model.user_factors.shape[0]:,}")
        print(f"[sanity] sparse_matrix rows      : {sparse_matrix.shape[0]:,}")

        if len(overlap) < 100:
            print("\nWARNING: Very few overlapping users. "
                  "This usually means the temporal split cutoff left most "
                  "users with no training history. Try --sample with a "
                  "larger number or check timestamp distribution.")

    # 8. Evaluation
    if args.evaluate and test_ratings is not None:
        print("\n── Step 6: Evaluation ───────────────────────────────────")

        eval_kwargs = dict(
            model=model,
            test_ratings=test_ratings,
            sparse_matrix=sparse_matrix,
            user_mapping=user_mapping,
            movie_mapping=movie_mapping,
            inv_user_mapping=inv_user_mapping,
            als_to_embed=als_to_embed,
            content_embeddings=content_embeddings,
            faiss_index=faiss_index,
            popular_movies=popular_movies,
            k=10,
            sample_users=500,
        )

        if args.alpha_sweep:
            best_alpha = alpha_sweep(**{**eval_kwargs, "sample_users": 200})
            print(f"\nRunning final evaluation with best alpha={best_alpha}")
            evaluate_model(**eval_kwargs, alpha=best_alpha)
        else:
            evaluate_model(**eval_kwargs, alpha=0.7)

    print(f"\n✓ Pipeline complete in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample", type=int, default=None)
    parser.add_argument("--evaluate", action="store_true")
    parser.add_argument("--alpha-sweep", action="store_true",
                        help="Sweep alpha values to find the best blend")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    main(args)