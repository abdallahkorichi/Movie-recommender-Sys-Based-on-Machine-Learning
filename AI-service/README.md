# Movie Recommender System

Hybrid recommender combining ALS collaborative filtering and sentence-transformer content embeddings, served via FastAPI.

---

## Setup

```bash
# 1. Clone / create project
cd movie_recommender

# 2. Install dependencies
pip install -r requirements.txt

# 3. Download MovieLens 25M
# https://grouplens.org/datasets/movielens/25m/
# Extract and place these three files:
#   data/raw/rating.csv
#   data/raw/movie.csv
#   data/raw/tag.csv
```

---

## Training

```bash
# Full training on all 25M ratings
python train.py

# Dev mode — subsample 500K ratings for fast iteration
python train.py --sample 500000

# Train + evaluate (uses 10% holdout)
python train.py --evaluate

# Force retrain even if artifacts exist
python train.py --force
```

Artifacts are saved to `artifacts/`:
- `als_model.pkl` — trained ALS model
- `sparse_matrix.pkl` — user-item interaction matrix
- `mappings.pkl` — user/movie index mappings
- `embeddings.npy` — MiniLM content embeddings (float32)

---

## Running the API

```bash
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

API docs at: http://localhost:8000/docs

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/recommend/{user_id}` | Personalised recs (cold-start safe) |
| GET | `/similar/{movie_id}` | "More like this" |
| GET | `/movies/{movie_id}` | Movie metadata |
| GET | `/movies/search?q=...` | Title search |
| GET | `/popular` | Most popular movies |
| GET | `/health` | Service health |

### Query parameters

- `k` — number of results (default 10, max 50)
- `alpha` — collaborative weight, 0.0–1.0 (default 0.7)

---

## Project structure

```
movie_recommender/
├── data/raw/              # MovieLens CSVs (not committed)
├── artifacts/             # Trained model artifacts (not committed)
├── src/
│   ├── data_loader.py     # CSV loading
│   ├── preprocessing.py   # Implicit conversion, content building
│   ├── collab_model.py    # ALS training + save/load
│   ├── content_model.py   # MiniLM embeddings
│   ├── hybrid.py          # Hybrid scoring + similar movies
│   └── evaluation.py      # Precision@K, Recall@K, NDCG@K, coverage, novelty
├── api/
│   └── main.py            # FastAPI app
├── train.py               # Full training pipeline
└── requirements.txt
```

---

## Mobile app (React Native)

```js
const API = "http://your-server:8000";

// Personalised recs
const res = await fetch(`${API}/recommend/${userId}?k=10`);
const { recommendations, cold_start } = await res.json();

// Enrich with TMDB (free API) for posters + trailers
// https://developer.themoviedb.org/docs
const tmdb = await fetch(
  `https://api.themoviedb.org/3/search/movie?query=${title}&api_key=YOUR_KEY`
);
```

## Website (Next.js)

```js
// pages/api/recommend.js
export default async function handler(req, res) {
  const { userId, k = 10 } = req.query;
  const data = await fetch(`http://your-server:8000/recommend/${userId}?k=${k}`)
    .then(r => r.json());
  res.json(data);
}
```

---

## Metrics to expect (MovieLens 25M, k=10)

| Metric | Typical range |
|--------|--------------|
| Precision@10 | 0.05 – 0.12 |
| Recall@10 | 0.02 – 0.06 |
| NDCG@10 | 0.08 – 0.18 |
| Hit Rate@10 | 0.35 – 0.55 |
| Catalog Coverage | 0.15 – 0.35 |

Higher alpha (→ 1.0) = more collaborative, better for users with many interactions.
Lower alpha (→ 0.0) = more content-based, better for cold-start / niche taste users.
