"""
db/mongo.py — MongoDB interaction layer

Collections:
    interactions   : every user event (rating, click, watch)
    retrain_log    : history of every retrain run with metrics

Schema for interactions:
    {
        userId   : int,
        movieId  : int,
        tmdbId   : int,         # for TMDB enrichment
        rating   : float,       # explicit rating (1-5)
        timestamp: datetime,
    }
"""

from datetime import datetime, timezone
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from AI-service root
load_dotenv(Path(__file__).parent.parent.parent / ".env")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("MONGO_DB",  "movie_recommender")


def get_db():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


def ensure_indexes():
    """Call once at API startup to create indexes."""
    db = get_db()
    db.interactions.create_index([("userId", ASCENDING), ("timestamp", DESCENDING)])
    db.interactions.create_index([("timestamp", DESCENDING)])
    db.retrain_log.create_index([("started_at", DESCENDING)])
    print("[mongo] Indexes ensured.")


def log_interaction(
    user_id: int,
    movie_id: int,
    tmdb_id: int = None,
    rating: float = None,
):
    """
    Log a single user star rating.
    """
    db = get_db()
    doc = {
        "userId":    user_id,
        "movieId":   movie_id,
        "tmdbId":    tmdb_id,
        "rating":    rating,
        "timestamp": datetime.now(timezone.utc),
    }
    db.interactions.insert_one(doc)


def get_interactions_since(since: datetime = None, min_rating: float = None):
    """
    Fetch interactions as a list of dicts, optionally filtered by time
    and minimum rating.

    Returns all interactions if since=None (used for full retrain).
    """
    db = get_db()
    query = {}
    if since:
        query["timestamp"] = {"$gte": since}
    if min_rating is not None:
        query["rating"] = {"$gte": min_rating}
    docs = list(db.interactions.find(query, {"_id": 0}))
    return docs


def get_all_interactions_as_dataframe():
    """
    Pull all ratings from MongoDB and return as a pandas DataFrame
    compatible with the existing train pipeline.
    """
    import pandas as pd
    docs = get_interactions_since()
    if not docs:
        return pd.DataFrame(columns=["userId", "movieId", "rating", "timestamp"])

    df = pd.DataFrame(docs)
    df = df.dropna(subset=["rating"])          # only rows with an explicit rating
    df["timestamp"] = df["timestamp"].astype("int64") // 10**9  # unix seconds
    return df[["userId", "movieId", "rating", "timestamp"]].reset_index(drop=True)


def log_retrain(metrics: dict, duration_seconds: float, triggered_by: str = "scheduler"):
    """Log a completed retrain run with its evaluation metrics."""
    db = get_db()
    db.retrain_log.insert_one({
        "started_at":        datetime.now(timezone.utc),
        "duration_seconds":  duration_seconds,
        "triggered_by":      triggered_by,
        "metrics":           metrics,
    })


def get_retrain_history(n: int = 10):
    """Return the last N retrain runs."""
    db = get_db()
    return list(
        db.retrain_log
        .find({}, {"_id": 0})
        .sort("started_at", DESCENDING)
        .limit(n)
    )


def interaction_count_since(since: datetime) -> int:
    db = get_db()
    return db.interactions.count_documents({"timestamp": {"$gte": since}})