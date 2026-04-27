import pandas as pd
import numpy as np


def convert_to_implicit(ratings: pd.DataFrame, threshold: float = 4.0) -> pd.DataFrame:
    """
    Convert explicit ratings to implicit binary signals.
    Ratings >= threshold are treated as positive interactions.
    """
    ratings = ratings.copy()
    ratings["implicit"] = (ratings["rating"] >= threshold).astype(int)

    # Only keep positive interactions for ALS training
    positive = ratings[ratings["implicit"] == 1].copy()
    print(f"[preprocessing] {len(positive):,} positive interactions "
          f"({len(positive)/len(ratings)*100:.1f}% of total) after threshold={threshold}")
    return positive


def build_movie_content(movies: pd.DataFrame, tags: pd.DataFrame) -> pd.DataFrame:
    """
    Build rich text content per movie for content-based embeddings.
    Combines title, genres, and user tags into a single content string.
    """
    tags = tags.copy()
    tags["tag"] = tags["tag"].fillna("").astype(str).str.lower().str.strip()

    # Aggregate tags per movie, weight by frequency
    tags_grouped = (
        tags.groupby("movieId")["tag"]
        .apply(lambda x: " ".join(x.value_counts().index[:30]))  # top 30 unique tags
        .reset_index()
        .rename(columns={"tag": "tags"})
    )

    movies = movies.merge(tags_grouped, on="movieId", how="left")
    movies["tags"] = movies["tags"].fillna("").astype(str)

    # Clean genres
    movies["genres_clean"] = (
        movies["genres"]
        .str.replace("|", " ", regex=False)
        .str.replace("(no genres listed)", "", regex=False)
        .str.lower()
    )

    # Extract year from title if present (e.g. "Toy Story (1995)")
    movies["year"] = movies["title"].str.extract(r"\((\d{4})\)").fillna("")

    # Combine into rich content string — repeat genres to upweight them
    movies["content"] = (
        movies["title"] + " "
        + movies["genres_clean"] + " "
        + movies["genres_clean"] + " "   # repeated for emphasis
        + movies["year"] + " "
        + movies["tags"]
    ).str.strip()

    print(f"[preprocessing] Built content for {len(movies):,} movies. "
          f"Avg content length: {movies['content'].str.len().mean():.0f} chars.")

    return movies[["movieId", "title", "genres", "content"]].reset_index(drop=True)


def get_popular_movies(ratings: pd.DataFrame, movies: pd.DataFrame, n: int = 100) -> list:
    """
    Get top-N most interacted movies. Used as cold-start fallback.
    Applies a Bayesian average to avoid small-count movies gaming the top.
    """
    counts = ratings.groupby("movieId").size().reset_index(name="count")
    # Bayesian average: (count / (count + m)) * score where m = median count
    m = counts["count"].median()
    counts["score"] = counts["count"] / (counts["count"] + m)
    top = counts.sort_values("score", ascending=False).head(n)
    return top["movieId"].tolist()
