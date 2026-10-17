# CineSense AI — Changelog

All notable changes, bug fixes, and feature additions will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - 2026-10-17

### Phase 0: Audit
- Completed comprehensive codebase and system audit (`AUDIT.md`).
- Documented all architectural paths across backend, frontend, database, AI, and third-party APIs.
- Identified 21 prioritized bugs, risks, and smells across backend and UI.
- Tagged pre-upgrade production state locally as `pre-upgrade-backup`.
- Created full project directory backup at `C:\Users\ankit\OneDrive\Desktop\CineSense-AI-backup-pre-upgrade`.

### Phase 1: Bug Fixes
- **Auth (G1)**: Implemented Refresh Token Rotation (RTR) in `auth_service.py` and `routers/auth.py`.
- **Auth (G2)**: Added in-memory sliding-window rate limiters for `/auth/login` (10/min) and `/auth/signup` (5/min) in `rate_limiter.py`.
- **Auth (G4)**: Fixed Axios 401 response interceptor in `client.ts` to rotate refresh tokens without invoking `localStorage.clear()` or forcing redirects on public endpoints.
- **Database (L1)**: Added `pool_pre_ping=True` and `pool_recycle=300` to `create_async_engine` in `database.py` to prevent Neon serverless connection drops.
- **Database (L2)**: Added Alembic migration `c1d2e3f4g5h6_add_movie_indexes.py` adding indexes on `release_date`, `vote_average`, `embedding_id`, and GIN trigram index on `title`.
- **Search (N1)**: Added `AbortController` cancellation token to `SearchPage.tsx` and `moviesApi.search` to eliminate asynchronous race conditions.
- **Carousel (I1)**: Stabilized `fetchFn` in `LiveMovieCarousel.tsx` and `HomePage.tsx` to prevent infinite re-fetching loops.
- **Watchlist (H1)**: Implemented global `useWatchlistStore` in Zustand with optimistic additions, removals, and automatic rollbacks on error.
- **Intent (A1)**: Implemented fast regex pre-classifier in `intent_service.py` to resolve obvious queries in <1ms without calling Groq.
- **FAISS Retrieval (B1)**: Implemented dynamic candidate over-fetching (`top_k=800`) when multi-filters are active to prevent post-filtering candidate starvation.

