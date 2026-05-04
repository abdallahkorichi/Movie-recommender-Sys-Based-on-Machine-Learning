import numpy as np
import pandas as pd
from typing import Optional


# Metric functions

def precision_at_k(recommended: list, relevant: set, k: int = 10) -> float:
    hits = sum(1 for item in recommended[:k] if item in relevant)
    return hits / k


def recall_at_k(recommended: list, relevant: set, k: int = 10) -> float:
    if not relevant:
        return 0.0
    hits = sum(1 for item in recommended[:k] if item in relevant)
    return hits / len(relevant)


def ndcg_at_k(recommended: list, relevant: set, k: int = 10) -> float:
    dcg = sum(
        1.0 / np.log2(rank + 2)
        for rank, item in enumerate(recommended[:k])
        if item in relevant
    )
    ideal_hits = min(len(relevant), k)
    idcg = sum(1.0 / np.log2(rank + 2) for rank in range(ideal_hits))
    return dcg / idcg if idcg > 0 else 0.0


def hit_rate_at_k(recommended: list, relevant: set, k: int = 10) -> float:
    return float(any(item in relevant for item in recommended[:k]))


def novelty_at_k(recommended: list, movie_popularity: dict, k: int = 10) -> float:
    scores = [-np.log2(movie_popularity.get(item, 1e-9) + 1e-9)
              for item in recommended[:k]]
    return float(np.mean(scores)) if scores else 0.0


def catalog_coverage(all_recommendations: list, total_movies: int) -> float:
    recommended_set = set(item for recs in all_recommendations for item in recs)
    return len(recommended_set) / total_movies


def temporal_train_test_split(ratings: pd.DataFrame, test_fraction: float = 0.1):
    """
    Split ratings by time rather than randomly.

    Why this matters
    ----------------
    A random split scatters a user's ratings across train/test, so the
    model might see 18 of their 20 movies and be tested on 2 random ones.
    That makes the task harder than it really is and underestimates quality.

    A temporal split trains on everything before a cutoff timestamp and
    tests on everything after. This mirrors real deployment: the model is
    trained on historical data and evaluated on future interactions. It is
    also how Netflix, Spotify, and every serious recommender paper measures
    performance.
    """
    ratings = ratings.sort_values("timestamp")
    cutoff_idx = int(len(ratings) * (1 - test_fraction))
    cutoff_timestamp = ratings.iloc[cutoff_idx]["timestamp"]

    train = ratings[ratings["timestamp"] < cutoff_timestamp].copy()
    test  = ratings[ratings["timestamp"] >= cutoff_timestamp].copy()

    # Only evaluate on users who appear in BOTH splits
    # (users only in test have no training history — they're cold start,
    #  not a fair measure of the personalised model)
    train_users = set(train["userId"].unique())
    test = test[test["userId"].isin(train_users)].copy()

    print(f"\n[evaluation] Temporal split at timestamp {cutoff_timestamp}")
    print(f"[evaluation] Train interactions : {len(train):,}")
    print(f"[evaluation] Test  interactions : {len(test):,}")
    print(f"[evaluation] Test  users        : {test['userId'].nunique():,} "
          f"(all seen in training)")
    return train, test


def evaluate_model(
    model,
    test_ratings: pd.DataFrame,
    sparse_matrix,
    user_mapping: dict,
    movie_mapping: dict,
    inv_user_mapping: dict,
    als_to_embed: dict,
    content_embeddings: np.ndarray,
    popular_movies: Optional[list] = None,
    k: int = 10,
    sample_users: int = 500,
    alpha: float = 0.7,
    min_test_ratings: int = 3,
) -> dict:
    """
    Evaluate the hybrid recommender on held-out test interactions.

    Args:
        min_test_ratings: skip users with fewer than this many test ratings.
                          Users with only 1 test movie make recall very noisy.
    """
    from src.hybrid import recommend_hybrid

    # Only evaluate on users who have enough test interactions
    user_test_counts = test_ratings.groupby("userId").size()
    qualified_users = user_test_counts[
        user_test_counts >= min_test_ratings
    ].index.tolist()

    print(f"[evaluation] Users with >= {min_test_ratings} test ratings: "
          f"{len(qualified_users):,}")

    sample_size = min(sample_users, len(qualified_users))
    sampled_ids = np.random.choice(qualified_users, sample_size, replace=False)

    # Popularity dict for novelty metric
    all_counts = test_ratings.groupby("movieId").size()
    movie_popularity = (all_counts / all_counts.max()).to_dict()

    metrics = {
        f"precision@{k}": [],
        f"recall@{k}": [],
        f"ndcg@{k}": [],
        f"hit_rate@{k}": [],
        f"novelty@{k}": [],
    }
    all_recs = []
    skipped = 0

    for uid in sampled_ids:
        user_test = test_ratings[test_ratings["userId"] == uid]
        relevant = set(user_test["movieId"].tolist())

        if not relevant:
            skipped += 1
            continue

        if uid not in inv_user_mapping:
            skipped += 1
            continue

        user_idx = inv_user_mapping[uid]
        if user_idx >= model.user_factors.shape[0]:
            skipped += 1
            continue

        recs = recommend_hybrid(
            user_id=int(uid),
            model=model,
            sparse_matrix=sparse_matrix,
            user_mapping=user_mapping,
            movie_mapping=movie_mapping,
            inv_user_mapping=inv_user_mapping,
            als_to_embed=als_to_embed,
            content_embeddings=content_embeddings,
            popular_movies=popular_movies,
            top_k=k,
            alpha=alpha,
        )

        if not recs:
            skipped += 1
            continue

        all_recs.append(recs)
        metrics[f"precision@{k}"].append(precision_at_k(recs, relevant, k))
        metrics[f"recall@{k}"].append(recall_at_k(recs, relevant, k))
        metrics[f"ndcg@{k}"].append(ndcg_at_k(recs, relevant, k))
        metrics[f"hit_rate@{k}"].append(hit_rate_at_k(recs, relevant, k))
        metrics[f"novelty@{k}"].append(novelty_at_k(recs, movie_popularity, k))

    results = {
        metric: float(np.mean(values)) if values else 0.0
        for metric, values in metrics.items()
    }
    results["catalog_coverage"] = catalog_coverage(all_recs, len(movie_mapping))
    results["users_evaluated"] = len(all_recs)
    results["users_skipped"] = skipped

    print(f"\n{'='*50}")
    print(f"  Evaluation  (k={k}, users={len(all_recs)}, alpha={alpha})")
    print(f"{'='*50}")
    for metric, val in results.items():
        if isinstance(val, float):
            bar = ""
            if "hit_rate" in metric:
                filled = int(val * 20)
                bar = f"  [{'#'*filled}{'.'*(20-filled)}]"
            print(f"  {metric:<24} {val:.4f}{bar}")
        else:
            print(f"  {metric:<24} {val}")
    print(f"{'='*50}\n")

    return results


def alpha_sweep(
    model,
    test_ratings: pd.DataFrame,
    sparse_matrix,
    user_mapping: dict,
    movie_mapping: dict,
    inv_user_mapping: dict,
    als_to_embed: dict,
    content_embeddings: np.ndarray,
    popular_movies: Optional[list] = None,
    k: int = 10,
    sample_users: int = 200,
    alphas: list = None,
):
    """
    Sweep alpha values and print a comparison table.
    Helps find the best collaborative vs content balance for your dataset.
    """
    if alphas is None:
        alphas = [0.3, 0.5, 0.7, 0.8, 0.9, 1.0]

    print(f"\n{'='*62}")
    print(f"  Alpha sweep  (k={k}, {sample_users} users per alpha)")
    print(f"{'='*62}")
    print(f"  {'alpha':>6}  {'hit@10':>8}  {'ndcg@10':>8}  "
          f"{'prec@10':>8}  {'coverage':>9}")
    print(f"  {'-'*54}")

    best_hit = 0
    best_alpha = 0.7

    for alpha in alphas:
        results = evaluate_model(
            model=model,
            test_ratings=test_ratings,
            sparse_matrix=sparse_matrix,
            user_mapping=user_mapping,
            movie_mapping=movie_mapping,
            inv_user_mapping=inv_user_mapping,
            als_to_embed=als_to_embed,
            content_embeddings=content_embeddings,
            popular_movies=popular_movies,
            k=k,
            sample_users=sample_users,
            alpha=alpha,
        )
        hit = results[f"hit_rate@{k}"]
        ndcg = results[f"ndcg@{k}"]
        prec = results[f"precision@{k}"]
        cov  = results["catalog_coverage"]
        flag = "  <- best" if hit > best_hit else ""
        print(f"  {alpha:>6.1f}  {hit:>8.4f}  {ndcg:>8.4f}  "
              f"{prec:>8.4f}  {cov:>9.4f}{flag}")
        if hit > best_hit:
            best_hit = hit
            best_alpha = alpha

    print(f"{'='*62}")
    print(f"  Best alpha: {best_alpha}  (hit_rate@{k} = {best_hit:.4f})")
    print(f"{'='*62}\n")
    return best_alpha