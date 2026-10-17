# CineSense AI — Comprehensive Codebase & System Audit (Phase 0)

*Audit Date: 2026-10-17 | Target Branch: upgrade/full-overhaul | Safety Status: Isolated Local Development*

---

## 1. System Map & Inventory

### 1.1 Backend Architecture (`backend/`)
- **App Entrypoint:** `backend/app/main.py` (FastAPI app, lifespan event, `/health` route, middleware, router inclusions)
- **Configuration & Settings:** `backend/app/config.py` (Pydantic `BaseSettings`, DB URLs, Groq keys, TMDB keys, FAISS paths)
- **Database Engine:** `backend/app/database.py` (SQLAlchemy 2.0 async engine, `AsyncSessionLocal`, session dependency `get_db`)
- **Middleware:** `backend/app/middleware.py` (CORS middleware)
- **Auth & Dependencies:** `backend/app/dependencies.py` (`get_current_user`, `get_optional_user`, Bearer token decode)
- **Database Models (`backend/app/models/`):**
  - `Movie`: Table `movies` (TMDB ID, title, overview, tagline, genres, keywords, posters, backdrop, runtime, vote_avg, vote_count, release_date, trailer_key, watch_providers, belongs_to_collection, cast_crew, embedding_id)
  - `User`: Table `users` (UUID, email, username, hashed_password, created_at, updated_at)
  - `RefreshToken`: Table `refresh_tokens` (UUID, user_id, token_hash, expires_at, created_at)
  - `Watchlist`: Table `watchlist` (UUID, user_id, movie_id, added_at, unique constraint on user+movie)
  - `RecommendationSession`: Table `recommendation_sessions` (UUID, user_id, mood_text, emotion_tags, filters, result_movie_ids)
- **API Routers (`backend/app/routers/`):**
  - `auth.py`: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
  - `recommend.py`: `POST /recommend` (Intent check, FAISS/SQL retrieval, post-filter, shuffle seed, pagination, session logging)
  - `movies.py`: `GET /movies/live/trending`, `GET /movies/live/now-playing`, `GET /movies/search`, `GET /movies/{id}`
  - `watchlist.py`: `POST /watchlist`, `GET /watchlist`, `DELETE /watchlist/{id}`
- **Services (`backend/app/services/`):**
  - `auth_service.py`: Password hashing via bcrypt, JWT encode/decode, refresh token hashing & lookup
  - `faiss_service.py`: FAISS index loading, sentence-transformer embedding generation (`all-MiniLM-L6-v2`), vector search (`IndexFlatIP`), vector reconstruction
  - `intent_service.py`: Groq LPU intent classifier (`llama-3.1-8b-instant`)
  - `llm_service.py`: Groq async client, explanation generation prompts, provider-agnostic abstraction
  - `tmdb_service.py`: Async & sync HTTP helpers, trending, now-playing, trailer & provider extractors, TTL caching
- **Data Ingestion & Pipeline (`backend/scripts/`):**
  - `fetch_movies.py`: TMDB async pipeline with semaphore concurrency (10 concurrent workers)
  - `build_embeddings.py`: Vector embeddings batch generation & FAISS FlatIP index builder
  - `backfill_cast_crew.py`: DB backfill utility for cast, crew, and collection data

### 1.2 Frontend Architecture (`frontend/`)
- **Framework & Config:** React 19 / Vite 8 / Tailwind CSS v4 / TypeScript (`frontend/package.json`, `vite.config.ts`, `tsconfig.json`)
- **API Client:** `frontend/src/api/client.ts` (Axios instance, JWT auth interceptor, 401 refresh queue, TMDB image helper)
- **API Modules:** `auth.ts`, `recommend.ts`, `movies.ts`, `watchlist.ts`
- **Global State Stores (`frontend/src/store/`):**
  - `authStore.ts`: User profile, access token, refresh token (Zustand with localStorage persistence)
  - `moodStore.ts`: Mood text, selected emoji tags, filters, cached recommendation results, seed, pagination
- **Custom Hooks (`frontend/src/hooks/`):**
  - `useAuth.ts`: Login, signup, logout actions
  - `useRecommendations.ts`: Discovery request handler, pagination, "surprise me", seed shuffling
  - `useMovieDetail.ts`: Single movie fetching with fallback
  - `useWatchlist.ts`: Watchlist retrieval, add, and remove operations
- **Pages (`frontend/src/pages/`):**
  - `HomePage.tsx`: Hero input, emoji tags, filter panel, trending & in-theater carousels
  - `RecommendationsPage.tsx`: Query header, movie card grid, pagination bar, shuffle button
  - `MovieDetailPage.tsx`: Backdrop, poster, metadata badges, trailer embed, streaming provider links
  - `SearchPage.tsx`: Debounced title search, live results grid
  - `WatchlistPage.tsx`: User saved movies, delete action
  - `AuthPage.tsx`: Sign in / Sign up tabbed modal
- **Components (`frontend/src/components/`):**
  - `layout/`: `Navbar.tsx`, `PageWrapper.tsx`
  - `movie/`: `MovieCard.tsx`, `MovieGrid.tsx`, `WhyThisMovie.tsx`, `GenreChip.tsx`, `TrailerEmbed.tsx`
  - `movies/`: `LiveMovieCarousel.tsx`
  - `mood/`: `EmojiTagSelector.tsx`, `MoodTextInput.tsx`
  - `filters/`: `GenreFilter.tsx`, `RatingFilter.tsx`
  - `ui/`: `Badge.tsx`, `Skeleton.tsx`, `Spinner.tsx`
- **Design Tokens & Styles:** `frontend/src/styles/globals.css`

---

## 2. Comprehensive Bug, Risk, and Smell Audit

| Item | Location | Severity | Description | Proposed Fix |
| :--- | :--- | :--- | :--- | :--- |
| **A1. Intent Engine Overhead** | `backend/app/services/intent_service.py:12-65` | **HIGH** | Groq is invoked for *every* query including trivial emoji tags (e.g. `😢`) or common phrases. Causes unnecessary latency (~500ms), API quota consumption, and exposure to Groq rate limits. | Add a fast rule-based regex pre-parser for obvious patterns (`movies like <title>`, `directed by <director>`, `with <actor>`, `<genre> from <year>`, or pure emoji inputs). Call Groq only for unstructured ambiguous natural language. |
| **A2. Intent Schema Fragility** | `backend/app/services/intent_service.py:58-64` | **MEDIUM** | If Groq returns non-JSON or misses fields, a generic `Exception` catches it and falls back to `MOOD`. No validation against a Pydantic schema or retry. | Validate JSON against a strict `IntentResponse` Pydantic model with 1 retry before falling back to `MOOD`. |
| **B1. FAISS Post-Filtering Drop** | `backend/app/routers/recommend.py:182-227` | **HIGH** | Vector search fetches `top_k=300`, and then strict filters (genre, min_rating, runtime, year) are applied *in memory*. With multiple strict filters, recall plummets, causing premature 404 "No movies match the given filters". | Over-fetch candidates dynamically (`top_k=800` when filters are active) and pre-index genre bitmasks or apply hybrid scoring so filtering doesn't empty the candidate pool. |
| **C1. Shuffle Non-Determinism & Duplicates** | `backend/app/routers/recommend.py:238-245` & `frontend/src/hooks/useRecommendations.ts:18-26` | **MEDIUM** | Client generates `Math.random() * 1000000` for seed. On pagination, `currentPage` and `seed` interact inconsistently in `useRecommendations`. A user clicking "Try Again" can accidentally receive previously shown films or duplicate pages. | Implement deterministic cursor-based or seeded permutation with session exclusion tracking: pass `exclude_ids` or partition the candidate pool so subsequent pages and try-agains never repeat. |
| **D1. Pagination Offset & Bound Errors** | `backend/app/routers/recommend.py:248-254` | **LOW** | If `filtered` is smaller than `start_idx` due to filter changes, empty lists or miscalculated `total_pages` can occur. | Clamp `page = max(1, min(page, total_pages))` and ensure `total_pages = max(1, ...)` consistently. |
| **E1. Fragile Entity Resolution** | `backend/app/routers/recommend.py:94-151` | **HIGH** | `ACTOR_DIRECTOR` uses strict substring `ilike(f"%{person_name}%")`. Any spelling typo (e.g., "Christoper Nolan") causes a hard 404. In `SIMILAR_TO_MOVIE`, `Movie.title.ilike(...)` matches arbitrary subtitles instead of highest-rated exact match. | Add fuzzy matching with `pg_trgm` similarity or Levenshtein distance fallback. For TMDB live lookups, sanitize input, match popularity, and verify movie poster/overview presence. |
| **F1. Generic & Hallucinatory Explanations** | `backend/app/routers/recommend.py:265-273` | **MEDIUM** | Explanations are currently static boilerplate strings (`"This Action and Sci-Fi film aligns with the mood you are looking for."`). They do not ground in actual movie themes, overview keywords, or user query terms. | Implement a grounded heuristic explanation generator that extracts matched mood tokens, plot synopsis highlights, and thematic tags. Provide an optional on-demand rich explanation endpoint for when users click "Why this?". |
| **G1. Missing Refresh Token Rotation** | `backend/app/routers/auth.py:51-63` & `backend/app/services/auth_service.py:76-96` | **CRITICAL** | When `/auth/refresh` is called, the existing refresh token is reused without rotation or invalidation! A stolen refresh token can be used indefinitely until expiration. | Implement strict **Refresh Token Rotation (RTR)**: Every refresh request invalidates the old token and issues a new cryptographically random token pair. Detect token reuse and revoke all tokens if a used token is presented. |
| **G2. Lack of Auth Rate Limiting** | `backend/app/routers/auth.py:13-50` | **HIGH** | No rate limiting on `/auth/login` or `/auth/signup`. Susceptible to brute force credential stuffing attacks. | Implement an in-memory/sliding-window rate limiter on auth routes (e.g. 5 attempts per minute per IP). |
| **G3. Insecure Token Storage & XSS** | `frontend/src/api/client.ts:12,29` & `frontend/src/store/authStore.ts:24-25` | **MEDIUM** | Access and refresh tokens are stored in plain `localStorage`. If any third-party script or dependency is compromised, tokens can be extracted via XSS. | Encapsulate token management in memory or secure storage utilities, sanitize all inputs, and implement safe token cleanup. |
| **G4. Stale Token 401 Force Redirect Bug** | `frontend/src/api/client.ts:31-33, 60-62` | **HIGH** | In Axios response interceptor, if any public endpoint returns 401 or refresh fails, it calls `localStorage.clear()` and `window.location.href = '/auth'`. This wipes out mood store preferences and forces an unauthenticated guest into `/auth`! | Never call `localStorage.clear()`; only remove auth tokens. Do not force redirect for optional-auth endpoints; only redirect if the route explicitly requires authentication. |
| **H1. Watchlist Disjoint State & Lack of Optimistic Rollback** | `frontend/src/hooks/useWatchlist.ts:25-45` | **MEDIUM** | Every component calling `useWatchlist` creates independent local `items` state. Adding a movie on `MovieCard` does not update the watchlist badge in `Navbar` or `MovieDetailPage`. Also, if deletion fails, there is no optimistic state rollback. | Centralize watchlist state into a global Zustand store (`useWatchlistStore`). Implement optimistic updates with automatic rollback and an undo toast. |
| **I1. Carousel Re-fetch Infinite Loop Smell** | `frontend/src/components/movies/LiveMovieCarousel.tsx:17-31` & `frontend/src/pages/HomePage.tsx:159,164` | **HIGH** | `HomePage` passes inline arrow functions as `fetchFn` to `LiveMovieCarousel`. Since `fetchFn` creates a new function reference every render and is in `useEffect([fetchFn])`, it causes constant re-triggering of carousel network requests. | Wrap fetchers in stable module-level functions or `useCallback`. Cache TMDB live trending results client-side. |
| **I2. Streaming Provider Direct Link Gaps** | `frontend/src/pages/MovieDetailPage.tsx:212-231` | **LOW** | Fallback to TMDB link if provider is not in the hardcoded list. Some regional providers in India and US (e.g., Lionsgate Play, MUBI, Criterion) lack direct query formatting. | Add expanded provider directory with accurate search query string mapping. |
| **J1. Render Free Tier Cold Start Blindness** | `frontend/src/App.tsx` & `frontend/src/api/client.ts` | **MEDIUM** | When Render backend sleeps (15 min idle), initial queries take 30–50s. The user sees a generic frozen spinner and assumes the app is broken. | Add a health ping detector on frontend boot. If backend is sleeping, display an elegant cinema-themed wake-up marquee: *"Waking up the projector... (warming up servers, ~30s)"* with a live progress indicator. |
| **K1. Data Quality & Embedding Anomalies** | `backend/scripts/build_embeddings.py:43-57` | **MEDIUM** | Movies with missing overview or tagline use only title or empty string, creating degraded embedding representations. Also, movies with very low vote counts (< 50) skew recommendation relevance. | Implement a data quality filter: movies with missing metadata get enriched via TMDB or excluded from recommendations. Introduce a `vote_count` floor in FAISS re-ranking so obscure low-rated noise does not rank above verified masterpieces. |
| **L1. Database Connection Leaks on Neon Serverless** | `backend/app/database.py:5-10` | **HIGH** | `create_async_engine` lacks `pool_pre_ping=True` and `pool_recycle=300`. Neon serverless drops idle connections, leading to `asyncpg.exceptions.ConnectionDoesNotExistError` on first query after idle. | Add `pool_pre_ping=True`, `pool_recycle=300`, and sensible connection pool limits (`pool_size=5`, `max_overflow=10`) suited for serverless Postgres. |
| **L2. Missing Database Indexes** | `backend/app/models/movie.py:12-31` | **HIGH** | Tables lack indexes on `movies.release_date`, `movies.vote_average`, `movies.title`, and `movies.belongs_to_collection`. Queries like `Movie.release_date.year < ...` or `order_by(Movie.vote_average.desc())` trigger full table scans. | Add an Alembic migration creating B-Tree indexes on `movies(release_date)`, `movies(vote_average)`, `movies(embedding_id)`, and a GIN trigram index on `movies(title)`. |
| **M1. Inconsistent Skeleton & Loading States** | `frontend/src/pages/RecommendationsPage.tsx:64` | **LOW** | `RecommendationsPage` renders `GridSkeleton count={8}` while default page size is 20, causing layout jump upon load. | Align skeleton counts with pagination limits and provide smooth shimmer states. |
| **N1. Search Race Condition** | `frontend/src/pages/SearchPage.tsx:17-45` | **HIGH** | In debounced title search, fast successive keystrokes trigger multiple concurrent network requests. If an older request completes after a newer one, stale search results overwrite the latest results. | Implement an `AbortController` cancellation token or request sequence timestamp so stale promises are discarded. |
| **O1. Responsive Breakpoint & Mobile Overflow** | `frontend/src/components/movies/LiveMovieCarousel.tsx:57-69` | **MEDIUM** | Negative margins (`marginLeft: -16px`) without proper container boundaries cause horizontal viewport overflow on 360px mobile screens. | Fix container wrapping, scroll padding, and touch scroll snap points across 360px, 768px, 1024px, 1440px viewports. |
| **P1. Visual Inconsistencies & Hardcoded Colors** | Across components (`MovieCard.tsx`, `WhyThisMovie.tsx`, `RatingFilter.tsx`, `AuthPage.tsx`) | **HIGH** | Hardcoded purple hex values (`rgba(124,58,237,...)`, `#f59e0b`, `#ef4444`) are scattered throughout inline styles, clashing with the specified classic cinema aesthetic. | Replace all arbitrary hex colors with unified CSS variables and Tailwind design tokens: deep warm near-black base (`#0c0b0a`), antique brass/gold accent (`#d4af37` / `#c5a059`), muted parchment text (`#e8e4dc`). |
| **Q1. Accessibility & Motion Gaps** | `frontend/src/components/movie/MovieCard.tsx`, `EmojiTagSelector.tsx` | **MEDIUM** | Icon buttons lack `aria-label`, interactive elements lack visible keyboard focus rings, and Framer Motion animations do not respect `prefers-reduced-motion`. | Add proper ARIA labels, visible gold-accent focus rings (`:focus-visible`), and wrap animations with `useReducedMotion()`. |
| **R1. Image Optimization & Cumulative Layout Shift** | `frontend/src/components/movie/MovieCard.tsx:49-57` | **MEDIUM** | Poster images lack explicit aspect ratio container constraints and responsive TMDB image sizes (`srcset`), leading to layout shifts (CLS) on slow networks. | Use strict aspect-ratio containers (`aspect-[2/3]`), TMDB `w342` / `w500` appropriately, `loading="lazy"`, and smooth blur-up placeholders. |
| **S1. Lack of Tactile Interaction Feedback** | `frontend/src/components/movie/MovieCard.tsx` | **LOW** | Cards have flat hover effects without depth, cursor spotlight, or subtle 3D tilt. Buttons lack clear active feedback. | Implement refined card hover lift, cursor spotlight effect, and smooth button press states. |

---

## 3. The 8 Proposed Cinema Design Concepts & Selection (Phase 3G)

1. **Interactive Film-Strip Search History & Journal:** A physical-feeling 35mm film reel strip at the bottom of the Discover/Profile screen showing snapshots of past mood searches with one-click reload. *(SELECTED FOR IMPLEMENTATION)*
2. **Ticket-Stub Style Watchlist & Cards:** The watchlist entries and detail actions render with subtle perforated edges, gold foil typography, cinema admission number, and barcode aesthetic ("ADMIT ONE"), giving every saved film tangible artifact status. *(SELECTED FOR IMPLEMENTATION)*
3. **Subtle "Now Showing" Retro Marquee:** A vintage theatre marquee ribbon with warm incandescent amber lettering and soft subtle flicker showing live trending cinema data and personalized recommendations. *(SELECTED FOR IMPLEMENTATION)*
4. **Dynamic Ambient Projection Tint (Canvas-sampled Backstage Glow):** When a movie card is hovered or detail opened, a lightweight 16x16 canvas extracts the dominant chromatic tone from the poster and diffuses a soft, warm theatre-projection bloom into the surrounding background. *(SELECTED FOR IMPLEMENTATION)*
5. **Interactive Mood Dial / Spectrum Wheel:** Arc spectrum dial allowing users to smoothly dial between Emotional Poles. *(DESCOPED: Would introduce clunky mobile touch gestures; tactile chips are more intuitive).*
6. **Time-Aware Cinema Program Clock:** Vintage mechanical clock dial filter. *(DESCOPED: Replaced by elegant runtime badge filters).*
7. **Curator's Spotlight & Audio Ambiance Snippets:** Background cinema room texture audio (vinyl crackle, reel hum). *(DESCOPED: Audio playback can disturb users without explicit sound permission).*
8. **Blind Date with a Movie (Mystery Film Canister):** An envelope mystery reveal mode. *(DESCOPED: Adds unnecessary gamification friction to the primary search journey).*

---

## 4. Prioritized Execution Plan (Phase 1 → Phase 6)

1. **Phase 1: Critical & High Bug Fixes**
   - Fix G1 (Refresh token rotation & reuse detection).
   - Fix G2 (Rate limiting on login & signup).
   - Fix G4 (Stale token 401 redirect & local storage wipe).
   - Fix L1 (Neon DB connection pooling & pre-ping).
   - Fix L2 (Database indexes for release_date, vote_average, title).
   - Fix N1 (Search debounced race condition with AbortController).
   - Fix I1 (Carousel infinite re-fetch loop).
   - Fix H1 (Centralize watchlist state with optimistic rollback).
   - Fix B1 (FAISS post-filtering over-fetch).
2. **Phase 2: Recommendation Accuracy & Genuineness**
   - Grounded natural explanations built from real movie keywords, overview, and matched query terms.
   - Normalized Match % calculation with transparent formula documentation.
   - Hybrid re-ranking (vector cosine similarity + vote count reliability floor + rating).
   - Fast rule-based intent router before Groq with Pydantic validation.
   - Evaluation harness (`backend/eval/`) with 40 golden test queries and Precision@10 metrics.
3. **Phase 3: Classic Cinema UI/UX Redesign**
   - Palette: Deep warm near-black base (`#0c0b0a`), muted gold/brass (`#d4af37`), warm parchment text (`#e8e4dc`).
   - Typography: Playfair Display / Cormorant serif headlines paired with clean Inter UI.
   - Faint 35mm film grain overlay and ambient theatre lighting.
   - Mood-reactive ambient tints & Canvas-sampled backlight projection.
   - Ticket-stub watchlist design and "Now Showing" marquee.
   - Mobile-first responsive optimization (360px to 1920px), WCAG AA compliance, and `prefers-reduced-motion`.
4. **Phase 4: High-Value Interactive Features**
   - User feedback loop (thumbs up/down/not interested) with taste vector personalization.
   - Watched status & rating tracking.
   - Smarter filters (runtime, year, language, streaming platform).
   - Mood history & film-strip journal with 1-click re-run.
   - Command palette (Ctrl+K) for instant navigation & search.
   - Detailed `/health/detailed` status endpoint.
5. **Phase 5: Full Verification & Automated Testing**
   - Pytest unit and integration tests (auth, intent, retrieval, watchlist, feedback).
   - Vitest & React Testing Library frontend tests.
   - Playwright end-to-end tests across viewports.
   - Accessibility (axe-core) & performance audit.
6. **Phase 6: Hardening, Checklist & Local Gate**
   - Linting, security checks, `PRE_PUSH_CHECKLIST.md`, and local verification.
