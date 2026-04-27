import numpy as np
import faiss
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


def build_faiss_index(embeddings: np.ndarray) -> faiss.IndexFlatIP:
    """
    Build a FAISS inner-product index for fast ANN search.
    Since embeddings are L2-normalized, inner product == cosine similarity.
    """
    index = faiss.IndexFlatIP(embeddings.shape[1])
    index.add(embeddings)
    print(f"[content_model] FAISS index built with {index.ntotal:,} vectors.")
    return index


def save_content_artifacts(embeddings: np.ndarray, index: faiss.IndexFlatIP):
    ARTIFACT_PATH.mkdir(exist_ok=True)
    np.save(ARTIFACT_PATH / "embeddings.npy", embeddings)
    faiss.write_index(index, str(ARTIFACT_PATH / "faiss.index"))
    print("[content_model] Content artifacts saved.")


def load_content_artifacts():
    embeddings = np.load(ARTIFACT_PATH / "embeddings.npy")
    index = faiss.read_index(str(ARTIFACT_PATH / "faiss.index"))
    print(f"[content_model] Loaded embeddings {embeddings.shape} + FAISS index.")
    return embeddings, index


def content_artifacts_exist() -> bool:
    return (
        (ARTIFACT_PATH / "embeddings.npy").exists() and
        (ARTIFACT_PATH / "faiss.index").exists()
    )
