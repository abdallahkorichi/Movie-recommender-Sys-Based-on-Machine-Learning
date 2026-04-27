import pandas as pd
from pathlib import Path

DATA_PATH = Path("data/raw")


def load_ratings() -> pd.DataFrame:
    """Load ratings CSV. Expected columns: userId, movieId, rating, timestamp."""
    path = DATA_PATH / "rating.csv"
    if not path.exists():
        raise FileNotFoundError(
            f"Ratings file not found at {path}. "
            "Download MovieLens 25M from https://grouplens.org/datasets/movielens/25m/"
        )
    df = pd.read_csv(path)
    print(f"[data_loader] Loaded {len(df):,} ratings from {df['userId'].nunique():,} users "
          f"and {df['movieId'].nunique():,} movies.")
    return df


def load_movies() -> pd.DataFrame:
    """Load movies CSV. Expected columns: movieId, title, genres."""
    path = DATA_PATH / "movie.csv"
    if not path.exists():
        raise FileNotFoundError(f"Movies file not found at {path}.")
    df = pd.read_csv(path)
    print(f"[data_loader] Loaded {len(df):,} movies.")
    return df


def load_tags() -> pd.DataFrame:
    """Load tags CSV. Expected columns: userId, movieId, tag, timestamp."""
    path = DATA_PATH / "tag.csv"
    if not path.exists():
        raise FileNotFoundError(f"Tags file not found at {path}.")
    df = pd.read_csv(path)
    print(f"[data_loader] Loaded {len(df):,} tags.")
    return df


def load_links() -> pd.DataFrame:
    path = DATA_PATH / "link.csv"
    df = pd.read_csv(path, dtype={"tmdbId": "Int64", "imdbId": str})
    df = df.dropna(subset=["tmdbId"])
    df["tmdbId"] = df["tmdbId"].astype(int)
    print(f"[data_loader] Loaded {len(df):,} movie links.")
    return df