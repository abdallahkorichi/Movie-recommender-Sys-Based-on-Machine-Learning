import numpy as np
import pickle
from pathlib import Path
from scipy.sparse import csr_matrix
import implicit

ARTIFACT_PATH = Path("artifacts")


def build_interaction_matrix(ratings):
    """
    Build a user x item sparse matrix (rows=users, cols=movies).
    """
    user_cats  = ratings["userId"].astype("category")
    movie_cats = ratings["movieId"].astype("category")

    user_ids  = user_cats.cat.codes
    movie_ids = movie_cats.cat.codes

    user_mapping      = dict(enumerate(user_cats.cat.categories))
    movie_mapping     = dict(enumerate(movie_cats.cat.categories))
    inv_user_mapping  = {v: k for k, v in user_mapping.items()}
    inv_movie_mapping = {v: k for k, v in movie_mapping.items()}

    # user x item — rows=users, cols=movies
    sparse_matrix = csr_matrix(
        (ratings["implicit"], (user_ids, movie_ids)),
        shape=(len(user_cats.cat.categories), len(movie_cats.cat.categories))
    )

    print(f"[collab_model] Interaction matrix: {sparse_matrix.shape[0]:,} users "
          f"x {sparse_matrix.shape[1]:,} movies | "
          f"density: {sparse_matrix.nnz / (sparse_matrix.shape[0] * sparse_matrix.shape[1]) * 100:.4f}%")

    return sparse_matrix, user_mapping, movie_mapping, inv_user_mapping, inv_movie_mapping


def train_als(sparse_matrix, factors=128, iterations=20, regularization=0.01):
    """
    Train ALS on a user x item matrix.

    implicit.fit(user_item) produces:
        model.user_factors  shape: (n_users, factors)  <- rows = users
        model.item_factors  shape: (n_items, factors)  <- rows = movies

    This is confirmed empirically — do NOT transpose before fitting.
    """
    n_users, n_items = sparse_matrix.shape

    model = implicit.als.AlternatingLeastSquares(
        factors=factors,
        iterations=iterations,
        regularization=regularization,
        use_gpu=False,
        random_state=42,
    )

    # Pass user x item directly — implicit rows become user_factors rows
    model.fit(sparse_matrix.tocsr())

    # Hard assertions — will catch any future orientation regression immediately
    assert model.user_factors.shape[0] == n_users, (
        f"user_factors has {model.user_factors.shape[0]} rows "
        f"but expected {n_users} users. Matrix orientation is wrong."
    )
    assert model.item_factors.shape[0] == n_items, (
        f"item_factors has {model.item_factors.shape[0]} rows "
        f"but expected {n_items} items. Matrix orientation is wrong."
    )

    print(f"[collab_model] ALS trained: {factors} factors, {iterations} iterations.")
    print(f"[collab_model] user_factors: {model.user_factors.shape}  "
          f"item_factors: {model.item_factors.shape}")

    return model


def save_collab_artifacts(model, sparse_matrix, user_mapping, movie_mapping,
                          inv_user_mapping, inv_movie_mapping):
    ARTIFACT_PATH.mkdir(exist_ok=True)
    with open(ARTIFACT_PATH / "als_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(ARTIFACT_PATH / "sparse_matrix.pkl", "wb") as f:
        pickle.dump(sparse_matrix, f)
    with open(ARTIFACT_PATH / "mappings.pkl", "wb") as f:
        pickle.dump({
            "user_mapping":      user_mapping,
            "movie_mapping":     movie_mapping,
            "inv_user_mapping":  inv_user_mapping,
            "inv_movie_mapping": inv_movie_mapping,
        }, f)
    print("[collab_model] Artifacts saved.")


def load_collab_artifacts():
    with open(ARTIFACT_PATH / "als_model.pkl", "rb") as f:
        model = pickle.load(f)
    with open(ARTIFACT_PATH / "sparse_matrix.pkl", "rb") as f:
        sparse_matrix = pickle.load(f)
    with open(ARTIFACT_PATH / "mappings.pkl", "rb") as f:
        maps = pickle.load(f)
    print("[collab_model] Artifacts loaded from disk.")
    print(f"[collab_model] user_factors: {model.user_factors.shape}  "
          f"item_factors: {model.item_factors.shape}  "
          f"matrix: {sparse_matrix.shape}")
    return (model, sparse_matrix,
            maps["user_mapping"], maps["movie_mapping"],
            maps["inv_user_mapping"], maps["inv_movie_mapping"])


def artifacts_exist():
    return all([
        (ARTIFACT_PATH / "als_model.pkl").exists(),
        (ARTIFACT_PATH / "sparse_matrix.pkl").exists(),
        (ARTIFACT_PATH / "mappings.pkl").exists(),
    ])