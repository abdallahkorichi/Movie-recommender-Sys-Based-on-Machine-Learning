[api_docs.md](https://github.com/user-attachments/files/27141027/api_docs.md)
# AuraFlix API Documentation

Base URL (local dev): `http://<your-machine-ip>:5000`

> All **Private** endpoints require an `Authorization: Bearer <token>` header.
> The token is returned from the login and register endpoints.

---

## Authentication

### `POST /api/auth/register`
Create a new user account.

**Body (JSON):**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "secret" }
```
**Response:**
```json
{
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "appUserId": 4,
  "token": "<jwt>"
}
```

---

### `POST /api/auth/login`
Log in and receive a JWT.

**Body (JSON):**
```json
{ "email": "john@example.com", "password": "secret" }
```
**Response:**
```json
{
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "appUserId": 4,
  "token": "<jwt>"
}
```

---

## User

### `GET /api/users/profile` 🔒 Private
Get the authenticated user's full profile including favorites and star ratings.

**Response:**
```json
{
  "_id": "...",
  "name": "John Doe",
  "email": "john@example.com",
  "appUserId": 4,
  "createdAt": "2026-04-14T00:00:00.000Z",
  "favorites": [
    { "_id": "...", "title": "Inception", "tmdbId": 27205, "movieId": 4638, "genres": "Action|Sci-Fi" }
  ],
  "ratings": {
    "<contentId>": 5,
    "<contentId>": 4
  }
}
```

> `ratings` is a flat map of MongoDB content `_id` → star value (1–5).

---

## Content (Movies)

### `GET /api/content`
Search and browse all movies in the database with optional filters.

**Query params:**
| Param | Type | Description |
|---|---|---|
| `search` | string | Title keyword search |
| `genre` | string | Filter by genre string (e.g. `Action`) |
| `type` | string | Content type (e.g. `movie`) |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |

**Example:** `GET /api/content?search=inception&limit=10`

**Response:**
```json
{
  "content": [ { "_id": "...", "title": "Inception", "tmdbId": 27205, "movieId": 4638, "genres": "Action|Sci-Fi" } ],
  "page": 1,
  "pages": 3,
  "total": 27
}
```

---

### `GET /api/content/:id`
Get a single movie document by its MongoDB `_id`.

**Response:**
```json
{ "_id": "...", "title": "Inception", "tmdbId": 27205, "movieId": 4638, "genres": "Action|Sci-Fi" }
```

---

## Recommendations (AI Engine)

### `GET /api/recommendations/popular?limit=20` 🌐 Public
Get the most popular movies ranked by the AI engine.

**Query params:**
| Param | Default | Description |
|---|---|---|
| `limit` | 20 | How many movies to return |

**Response:** `Array` of content objects (same shape as `/api/content`)

---

### `GET /api/recommendations/personalized` 🔒 Private
Get AI-personalized movie recommendations for the authenticated user.
Returns an empty array `[]` if the user has not rated enough movies yet.

**Response:** `Array` of content objects sorted by AI score.

---

### `GET /api/recommendations/similar/:contentId` 🌐 Public
Get movies similar to a given movie using content-based AI embeddings.

**Params:** `:contentId` — MongoDB `_id` of the movie

**Response:** `Array` of up to 10 similar content objects.

---

### `POST /api/recommendations/interact` 🔒 Private
Submit a star rating for a movie. This:
1. Persists the rating to the user's `ratings` map in MongoDB (cross-device)
2. Auto-adds movie to `favorites` if rating ≥ 4
3. Forwards the rating to the Python AI engine for training

**Body (JSON):**
```json
{ "contentId": "<mongodb _id>", "rating": 5 }
```
`rating` must be an integer between 1 and 5.

**Response:**
```json
{ "message": "Rating logged to AI engine." }
```

---

## Content Object Shape
All movie endpoints return documents in this format:
```json
{
  "_id": "664a1f...",
  "title": "Inception",
  "movieId": 4638,
  "tmdbId": 27205,
  "genres": "Action|Sci-Fi|Thriller",
  "type": "movie"
}
```
Use `tmdbId` to fetch full poster, backdrop, overview, and cast from the **TMDB API** (`https://api.themoviedb.org/3/movie/{tmdbId}`).

---

## Error Responses
All errors follow this shape:
```json
{ "message": "Descriptive error message" }
```
| Status | Meaning |
|---|---|
| `400` | Bad request / validation error |
| `401` | Missing or invalid token |
| `404` | Resource not found |
| `500` | Server/AI engine error |
