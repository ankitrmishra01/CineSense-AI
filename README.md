# CineSense AI 🎬

> **Emotion-aware movie discovery platform** — describe your mood and get AI-powered movie recommendations with natural-language explanations.

---

## Architecture

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind CSS v4 + Framer Motion + React Router |
| Backend | FastAPI + SQLAlchemy (async) + Alembic |
| Database | PostgreSQL |
| Vector Search | FAISS (`all-MiniLM-L6-v2` embeddings) |
| LLM (explanations) | Groq API (`llama-3.1-8b-instant`) |
| Movie Data | TMDB API |

---

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+ (running locally or via Docker)
- TMDB API key — [get free key](https://www.themoviedb.org/settings/api)
- Groq API key — [get free key](https://console.groq.com/)

---

## Setup

### 1. Clone & configure environment

```bash
# Copy and fill in the backend .env
cp backend/.env.example backend/.env
# Copy and fill in the frontend .env
cp frontend/.env.example frontend/.env
```

**Required `.env` variables** (in `backend/.env`):

```env
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/cinesense
SYNC_DATABASE_URL=postgresql+psycopg2://postgres:yourpassword@localhost:5432/cinesense
SECRET_KEY=your-super-secret-key-at-least-32-chars
TMDB_API_KEY=your_tmdb_api_key
GROQ_API_KEY=your_groq_api_key
```

### 2. Start PostgreSQL

**Option A — Docker (recommended):**
```bash
docker-compose up postgres -d
```

**Option B — Local PostgreSQL:**
```bash
# Create the database
psql -U postgres -c "CREATE DATABASE cinesense;"
```

### 3. Backend setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head
```

### 4. Data pipeline (required before first use)

**Step 1 — Fetch movies from TMDB (~5,000–10,000 movies, takes 30–60 min):**
```bash
cd backend
python scripts/fetch_movies.py
```

> ⚠️ This makes many TMDB API calls. The script respects rate limits (~20 req/s) automatically.

**Step 2 — Build FAISS embeddings index (~5–10 min on CPU):**
```bash
python scripts/build_embeddings.py
```

This creates:
- `backend/faiss_index/movies.index`
- `backend/faiss_index/id_map.json`

### 5. Start the backend

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

### 6. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env    # VITE_API_URL=http://localhost:8000
npm run dev
```

Frontend available at: http://localhost:5173

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | — | Register new user |
| POST | `/auth/login` | — | Login, get JWT |
| POST | `/auth/refresh` | — | Refresh access token |
| POST | `/auth/logout` | — | Invalidate refresh token |
| POST | `/recommend` | Optional | Get mood-based movie recommendations |
| GET | `/movies/{id}` | — | Get full movie details |
| GET | `/movies/search?q=` | — | Title search |
| POST | `/watchlist` | ✅ | Add movie to watchlist |
| GET | `/watchlist` | ✅ | Get user's watchlist |
| DELETE | `/watchlist/{id}` | ✅ | Remove from watchlist |

---

## How Recommendations Work

1. User inputs mood text (e.g., *"I'm feeling lonely and want something comforting"*) and/or emoji tags
2. Text is embedded using `all-MiniLM-L6-v2` (sentence-transformers)
3. FAISS cosine similarity search finds top 100 candidate movies
4. Candidates are filtered by optional genre/rating/runtime constraints
5. Top 8 movies selected by similarity score
6. **Single batched Groq API call** generates a short "why this movie" explanation for all 8 at once
7. Results returned with explanations; session saved if user is authenticated

---

## Project Structure

```
cinesense-ai/
├── backend/
│   ├── alembic/              # DB migrations
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── config.py         # Settings (pydantic-settings)
│   │   ├── database.py       # SQLAlchemy async engine
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # FastAPI route handlers
│   │   ├── services/         # Business logic (auth, FAISS, LLM, TMDB)
│   │   ├── dependencies.py   # FastAPI Depends (get_db, get_current_user)
│   │   └── middleware.py     # CORS
│   ├── scripts/
│   │   ├── fetch_movies.py   # TMDB data pipeline
│   │   └── build_embeddings.py # FAISS index builder
│   └── faiss_index/          # Created after running build_embeddings.py
└── frontend/
    └── src/
        ├── api/              # Axios API modules
        ├── components/       # UI, layout, movie, mood, filter components
        ├── hooks/            # React hooks
        ├── pages/            # Route pages
        ├── store/            # Zustand state
        ├── styles/           # Global CSS
        └── types/            # TypeScript interfaces
```

---

## Swapping the LLM Provider

The LLM layer is provider-agnostic. To switch from Groq to another provider:

1. Open `backend/app/services/llm_service.py`
2. Implement a new class inheriting `BaseLLMProvider`
3. Change the return value in `get_llm_provider()` to your new class

No changes needed in routers or anywhere else.

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Async PostgreSQL URL (`postgresql+asyncpg://...`) |
| `SYNC_DATABASE_URL` | ✅ | Sync PostgreSQL URL for Alembic + scripts |
| `SECRET_KEY` | ✅ | JWT signing secret (min 32 chars) |
| `TMDB_API_KEY` | ✅ | TMDB API v3 key |
| `GROQ_API_KEY` | ✅ | Groq API key |
| `GROQ_MODEL` | — | Default: `llama-3.1-8b-instant` |
| `EMBEDDING_MODEL` | — | Default: `all-MiniLM-L6-v2` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | Default: 60 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | Default: 30 |

---

## Out of Scope (Phase 2+)

- Voice input
- Friends / group mode
- Personality quiz
- Mood analytics / timeline
- CineBot chat assistant
