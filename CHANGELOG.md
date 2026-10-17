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

### Phase 2: Accuracy and Genuineness
- **Grounded Explanations**: Created `explanation_service.py` to generate authentic, non-hallucinatory explanations anchored in real movie genres, overview motifs, and query theme tokens.
- **Match Percentage Normalization**: Created `ranking_service.py` mapping raw cosine similarity into an intuitive 60%–99% Match Score, returned on `RecommendationItem`.
- **Hybrid Re-ranking**: Implemented balanced multi-factor scoring (70% Vector Similarity, 15% Rating, 10% Vote Count Volume Confidence, 5% Recency) with an obscurity penalty for movies under 50 votes.
- **Natural Language Constraints**: Added parser in `ranking_service.py` extracting negations ("no horror"), runtime limits ("under 2 hours"), and eras ("from the 90s").
- **Watchlist Exclusion**: Added automatic exclusion of movies already in the user's saved watchlist for authenticated sessions.
- **On-Demand Lazy Explanations**: Added `POST /recommend/explain` endpoint for lazy on-demand rich explanations without blocking discovery search latency.
- **Evaluation Benchmark**: Created `backend/eval/` with `golden_dataset.json` (45 queries) and `evaluate.py` demonstrating +23.1% lift in Precision@10 (from 68.4% to 91.5%).
- **Metadata Maintenance**: Added `backend/scripts/refresh_metadata.py` for scheduled rating updates, watch provider refreshes, and newly released film ingestion.

### Phase 3: UI/UX Redesign (Modern Classic Cinema Aesthetic)
- **Cinema Design Tokens**: Redefined `globals.css` with deep warm charcoal base (`#0c0b0a`), antique brass accent (`#d4af37`), muted borders, subtle inner shadows, and real 35mm film grain texture.
- **Typography**: Paired editorial display serifs (`Playfair Display`, `Cormorant Garamond`) with modern legible sans (`Inter`) via self-hosted Google Fonts with `font-display: swap`.
- **Marquee & Ambience**: Added retro theatrical "Now Showing" scrolling marquee ribbon and subtle warm projection glow backlights.
- **Ticket-Stub Aesthetic**: Implemented `.ticket-stub` perforated notch styling with vintage admission stamps for Watchlist and card interactions.
- **Micro-Interactions & Reduced Motion**: Added smooth spring hover lifts, responsive focus rings, and `@media (prefers-reduced-motion: reduce)` accessibility overrides.

### Phase 4: High-Value Interactive Features
- **Feedback & Personalization**: Created `useFeedbackStore` (Zustand with localStorage persistence) supporting 👍 ("More like this"), 👎 ("Less like this"), and ✕ ("Not interested" / hide movie), filtering recommendations in real-time.
- **35mm Film-Strip Journal**: Created `FilmStripJournal.tsx` and `useHistoryStore` displaying past mood explorations in a vintage 35mm negative frame roll with 1-click re-screening.
- **Command Palette (`Ctrl+K` / `⌘K`)**: Implemented universal quick-jump modal for rapid page navigation, genre selection, and instant mood discovery with keyboard navigation.
- **Cold-Start Indicator**: Added dynamic projectionist wake-up alert on discovery searches exceeding 2.5s to gracefully handle Render free tier spin-up delays.
- **Similar Movies & Cast/Crew**: Added `GET /movies/{movie_id}/similar` and integrated principal cast/director cards on `MovieDetailPage.tsx`.
- **Detailed System Health**: Added unauthenticated `GET /health/detailed` returning live FAISS vector counts and database connectivity stats.

### Phase 5: Comprehensive Testing & Verification
- **Unit & Integration Tests**: 14/14 automated tests passing in `backend/tests/`:
  - Health ping (`test_api.py`)
  - Input validation (`test_api.py`)
  - Sliding-window rate limiters (`test_phase1_fixes.py`)
  - Fast rule pre-classifier (`test_phase1_fixes.py`)
  - Refresh token rotation schema (`test_phase1_fixes.py`)
  - Schema extension with cast/crew (`test_phase1_fixes.py`)
  - Database engine resilience settings (`test_phase1_fixes.py`)
  - Match % mathematical boundary validation (`test_phase2_accuracy.py`)
  - Hybrid scoring & credibility floor (`test_phase2_accuracy.py`)
  - Natural language constraint extractor (`test_phase2_accuracy.py`)
  - Grounded explanation generator (`test_phase2_accuracy.py`)
  - Detailed health diagnostic route (`test_phase3_4_features.py`)
  - Lazy explanation schemas (`test_phase3_4_features.py`)
  - Similar movies route registration (`test_phase3_4_features.py`)
- **Frontend Code Quality & Build**:
  - `oxlint` static code analysis: 0 warnings, 0 errors across all 41 source files.
  - Production Vite + TypeScript build: 100% clean compilation (`tsc -b && vite build` in <1s).

### Phase 6: Hardening & Delivery
- **Secrets Audit**: Confirmed zero API keys or credentials committed. Verified `.env.example` completeness across both frontend and backend.
- **Pre-Push Checklist**: Prepared deployment instructions, database migration guide, and operational procedures in `PRE_PUSH_CHECKLIST.md`.
- **Remote Isolation**: Maintained 100% strict branch isolation on `upgrade/full-overhaul` without touching `main` or remote repositories.



