import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer

ARTIFACT_PATH = Path("artifacts")
EMBED_DIM = 384   # all-MiniLM-L6-v2 output dimension


def train_content_embeddings(movie_content, batch_size: int = 512) -> np.ndarray:
    """
    Encode movie content strings into dense embeddings.
    Returns float32 array of shape (n_movies, 384).
    """
    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(
        movie_content["content"].tolist(),
        batch_size=batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,   # L2-normalize → cosine sim = dot product
    )
    print(f"[content_model] Embeddings shape: {embeddings.shape}")
    return embeddings.astype("float32")


def save_content_artifacts(embeddings: np.ndarray):
    ARTIFACT_PATH.mkdir(exist_ok=True)
    np.save(ARTIFACT_PATH / "embeddings.npy", embeddings)
    print("[content_model] Content artifacts saved.")


def load_content_artifacts():
    embeddings = np.load(ARTIFACT_PATH / "embeddings.npy")
    print(f"[content_model] Loaded embeddings {embeddings.shape}.")
    return embeddings


def content_artifacts_exist() -> bool:
    return (ARTIFACT_PATH / "embeddings.npy").exists()
