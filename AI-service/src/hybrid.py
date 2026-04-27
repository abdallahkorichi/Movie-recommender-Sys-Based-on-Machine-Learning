import numpy as np
from typing import Optional


def _normalize(arr: np.ndarray) -> np.ndarray:
    """Min-max normalize to [0, 1]. Handles constant arrays safely."""
    mn, mx = arr.min(), arr.max()
    if mx - mn < 1e-9:
        return np.zeros_like(arr)
    return (arr - mn) / (mx - mn)


def build_alignment_map(
    movie_mapping: dict,
    movieid_to_embed_idx: dict,
) -> dict:
    """
    Build a translation map:  als_item_idx  ->  embed_idx

    Why this is necessary
    ---------------------
    ALS sees only movies that appeared in rating.csv (26,744 of them).
    Content embeddings are built from ALL movies in movie.csv (27,278).
    Both use their own 0-based integer indices internally, so:

        ALS item index 500  !=  embedding index 500

    They can only be connected through the shared movieId column.
    This function builds that bridge once at startup so every subsequent
    lookup is a pure dict get - O(1), no scanning.

    Args:
        movie_mapping:        {als_item_idx: movieId}   (from collab_model)
        movieid_to_embed_idx: {movieId: embed_idx}      (built at API startup)

    Returns:
        {als_item_idx: embed_idx}  only for movies present in BOTH spaces
    """
    als_to_embed = {}
    missing = 0
    for als_idx, movie_id in movie_mapping.items():
        embed_idx = movieid_to_embed_idx.get(movie_id)
        if embed_idx is not None:
            als_to_embed[als_idx] = embed_idx
        else:
            missing += 1

    print(f"\n[alignment] ALS items        : {len(movie_mapping):,}")
    print(f"[alignment] Embedding items   : {len(movieid_to_embed_idx):,}")
    print(f"[alignment] Aligned (both)    : {len(als_to_embed):,}")
    print(f"[alignment] ALS-only (no emb) : {missing:,}  "
          f"<- movies rated but absent from movie.csv (safe to skip)")

    return als_to_embed


def validate_alignment(
    als_to_embed: dict,
    movie_mapping: dict,
    movieid_to_embed_idx: dict,
    content_embeddings: np.ndarray,
    movie_content,
    n_spot_checks: int = 5,
) -> bool:
    """
    Spot-check that als_to_embed is correct by verifying each movieId
    round-trips cleanly through both mappings and every embedding index
    is within bounds.

    Prints a readable table so you can visually confirm alignment.
    Returns True if all checks pass, False if any fail.
    """
    print("\n" + "="*65)
    print("  Alignment spot-check")
    print("="*65)
    print(f"  {'ALS idx':>8}  {'movieId':>8}  {'embed idx':>10}  {'title':<28}  status")
    print("-"*65)

    embed_idx_to_movieid = {v: k for k, v in movieid_to_embed_idx.items()}
    # Use just the first word of content as a rough title proxy
    movieid_to_title = {
        row["movieId"]: row["content"].split(" ")[0]
        for _, row in movie_content.iterrows()
    }

    sample_als_indices = list(als_to_embed.keys())[:n_spot_checks]
    all_ok = True

    for als_idx in sample_als_indices:
        embed_idx = als_to_embed[als_idx]
        movie_id_via_als = movie_mapping[als_idx]
        movie_id_via_embed = embed_idx_to_movieid.get(embed_idx, -1)

        ids_match = (movie_id_via_als == movie_id_via_embed)
        in_bounds = (embed_idx < len(content_embeddings))
        ok = ids_match and in_bounds

        flag = "OK" if ok else "MISMATCH"
        title = str(movieid_to_title.get(movie_id_via_als, "?"))[:26]
        print(f"  {als_idx:>8}  {movie_id_via_als:>8}  {embed_idx:>10}  {title:<28}  {flag}")

        if not ok:
            all_ok = False
            if not ids_match:
                print(f"           ERROR: ALS->movieId={movie_id_via_als} "
                      f"but embed->movieId={movie_id_via_embed}")
            if not in_bounds:
                print(f"           ERROR: embed_idx={embed_idx} >= "
                      f"len(embeddings)={len(content_embeddings)}")

    print("="*65)
    print(f"  Result: {'ALL CHECKS PASSED' if all_ok else 'FAILED - see errors above'}")
    print("="*65 + "\n")
    return all_ok


def recommend_hybrid(
    user_id: int,
    model,
    sparse_matrix,
    user_mapping: dict,
    movie_mapping: dict,
    inv_user_mapping: dict,
    als_to_embed: dict,
    content_embeddings: np.ndarray,
    faiss_index,
    popular_movies=None,
    top_k: int = 10,
    alpha: float = 0.7,
    candidate_pool: int = 300,
    popularity_penalty: float = 0.05,
) -> list:
    """
    Hybrid recommender using properly aligned ALS + content indices.

    als_to_embed bridges the two index spaces via movieId so there are
    no out-of-bounds errors and no silent wrong-movie lookups.
    """

    # Cold-start fallback
    if user_id not in inv_user_mapping:
        return (popular_movies or [])[:top_k]
    
    user_idx = inv_user_mapping[user_id]
    if user_idx >= model.user_factors.shape[0]:
        return (popular_movies or [])[:top_k]

    # Collaborative scores
    user_vec = model.user_factors[user_idx]
    collab_raw = model.item_factors @ user_vec   # (n_als_items,)

    # Filter to only ALS items that have a corresponding embedding
    valid_als_indices = np.array(list(als_to_embed.keys()), dtype=np.int32)
    collab_valid = collab_raw[valid_als_indices]

    # Top candidate_pool from the valid set only
    pool = min(candidate_pool, len(valid_als_indices))
    top_positions = np.argpartition(collab_valid, -pool)[-pool:]
    top_positions = top_positions[np.argsort(collab_valid[top_positions])[::-1]]

    top_als_indices = valid_als_indices[top_positions]
    top_embed_indices = np.array(
        [als_to_embed[i] for i in top_als_indices], dtype=np.int32
    )

    collab_scores_norm = _normalize(collab_valid[top_positions])

    # Content scores
    user_interactions = sparse_matrix[user_idx].toarray().flatten()
    liked_als_indices = np.where(user_interactions > 0)[0]
    liked_embed_indices = np.array(
        [als_to_embed[i] for i in liked_als_indices if i in als_to_embed],
        dtype=np.int32,
    )

    if len(liked_embed_indices) > 0:
        liked_vecs = content_embeddings[liked_embed_indices]
        user_taste_vec = liked_vecs.mean(axis=0, keepdims=True)
        norm = np.linalg.norm(user_taste_vec)
        if norm > 1e-9:
            user_taste_vec = user_taste_vec / norm
        candidate_vecs = content_embeddings[top_embed_indices]
        content_scores_raw = (candidate_vecs @ user_taste_vec.T).flatten()
        content_scores_norm = _normalize(content_scores_raw)
    else:
        content_scores_norm = np.zeros(len(top_embed_indices))

    # Popularity penalty
    movie_interaction_counts = np.asarray(sparse_matrix.sum(axis=0)).flatten()
    candidate_counts = movie_interaction_counts[top_als_indices]
    penalty = popularity_penalty * _normalize(candidate_counts)

    # Combine
    final_scores = (
        alpha * collab_scores_norm
        + (1 - alpha) * content_scores_norm
        - penalty
    )

    # Filter seen movies
    seen_mask = user_interactions[top_als_indices] > 0
    final_scores[seen_mask] = -1.0

    # Pick top-k
    best_positions = np.argsort(final_scores)[::-1][:top_k]
    best_als_indices = top_als_indices[best_positions]

    return [movie_mapping[i] for i in best_als_indices if i in movie_mapping]


def recommend_similar_movies(
    movie_id: int,
    movieid_to_embed_idx: dict,
    content_embeddings: np.ndarray,
    movie_content,
    top_k: int = 10,
) -> list:
    """
    Find movies with similar content. Uses movieid_to_embed_idx directly
    so there is no dependence on ALS indices at all.
    """
    if movie_id not in movieid_to_embed_idx:
        return []

    embed_idx = movieid_to_embed_idx[movie_id]
    query_vec = content_embeddings[embed_idx:embed_idx + 1]

    sims = (content_embeddings @ query_vec.T).flatten()
    sims[embed_idx] = -1.0

    top_embed_indices = np.argsort(sims)[::-1][:top_k]
    embed_idx_to_movieid = {v: k for k, v in movieid_to_embed_idx.items()}
    return [embed_idx_to_movieid[i] for i in top_embed_indices if i in embed_idx_to_movieid]
