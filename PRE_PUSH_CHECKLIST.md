# CineSense AI — Pre-Push & Deployment Checklist

This document details the exact status, verification results, database migration steps, and deployment procedures for the **CineSense AI Full-Stack Upgrade**.

---

## 1. Branch & Git Status
- **Active Branch**: `upgrade/full-overhaul` (isolated local branch; NOT pushed to origin).
- **Safety Precaution**: Tagged production state as `pre-upgrade-backup`. Full project directory backup saved at `C:\Users\ankit\OneDrive\Desktop\CineSense-AI-backup-pre-upgrade`.
- **Remote Push Status**: **HALTED**. Awaiting explicit user confirmation (`APPROVED, PUSH`).

---

## 2. Verified Test Results & Benchmark Metrics

### A. Python Backend Test Suite (Pytest)
```text
tests/test_api.py::test_health_check PASSED                              [  7%]
tests/test_api.py::test_recommend_validation_error PASSED                [ 14%]
tests/test_phase1_fixes.py::test_rate_limiter_allows_and_blocks PASSED   [ 21%]
tests/test_phase1_fixes.py::test_intent_rule_based_classifier PASSED     [ 28%]
tests/test_phase1_fixes.py::test_token_refresh_response_schema PASSED    [ 35%]
tests/test_phase1_fixes.py::test_movie_out_schema_includes_cast_crew_and_collection PASSED [ 42%]
tests/test_phase1_fixes.py::test_database_engine_resilience_settings PASSED [ 50%]
tests/test_phase2_accuracy.py::test_match_percentage_bounds_and_values PASSED [ 57%]
tests/test_phase2_accuracy.py::test_compute_hybrid_score_favors_credible_titles PASSED [ 64%]
tests/test_phase2_accuracy.py::test_extract_natural_constraints PASSED   [ 71%]
tests/test_phase2_accuracy.py::test_grounded_explanation_generation PASSED [ 78%]
tests/test_phase3_4_features.py::test_detailed_health_check PASSED       [ 85%]
tests/test_phase3_4_features.py::test_explain_schemas PASSED             [ 92%]
tests/test_phase3_4_features.py::test_similar_movies_route_registered PASSED [100%]

======================= 14 passed in 5.82s =======================
```

### B. Golden Evaluation Benchmark (45 Queries)
```text
• Intent Classification Accuracy: 95.6% (43/45 queries)
• Fast Rule Accelerator Coverage: 46.7% (<1ms instant resolution)
• Natural Constraint Precision:   100.0% (4/4 structured filters extracted)
• Precision@10 Baseline (Before): 68.4%
• Precision@10 Hybrid (After):    91.5%  (+23.1% lift)
```

### C. Frontend Code Quality & Build
```text
• oxlint static analysis: 0 warnings, 0 errors across 41 files
• Vite + TypeScript production build: SUCCESS (dist generated cleanly in 832ms)
```

---

## 3. Database Migration Steps (Neon PostgreSQL)

When you are ready to apply the performance indexes to your Neon PostgreSQL production database:

```bash
cd backend
# Make sure your production DATABASE_URL / SYNC_DATABASE_URL is set in your environment
alembic upgrade head
```

This migration (`c1d2e3f4g5h6_add_movie_indexes.py`):
1. Creates index `idx_movies_release_date` on `movies(release_date DESC)`.
2. Creates index `idx_movies_vote_average` on `movies(vote_average DESC)`.
3. Creates index `idx_movies_embedding_id` on `movies(embedding_id)`.
4. Creates PostgreSQL extension `pg_trgm` and GIN index `idx_movies_title_trgm` on `movies USING gin (title gin_trgm_ops)` for sub-millisecond title fuzzy search.

---

## 4. Environment Variables Checklist

Ensure these variables are configured on Render (backend) and Vercel (frontend):

### Render Backend:
- `DATABASE_URL`: `postgresql+asyncpg://...` (Neon pooler URL)
- `SYNC_DATABASE_URL`: `postgresql+psycopg2://...` (For Alembic migrations)
- `SECRET_KEY`: Long random string for JWT auth
- `ALGORITHM`: `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES`: `60`
- `REFRESH_TOKEN_EXPIRE_DAYS`: `30`
- `TMDB_API_KEY`: TMDB v3 API Key
- `GROQ_API_KEY`: Groq API Key
- `GROQ_MODEL`: `llama-3.1-8b-instant`
- `CORS_ORIGINS`: `["https://cine-sense-ai.vercel.app","http://localhost:5173"]`

### Vercel Frontend:
- `VITE_API_URL`: Your Render backend URL (e.g. `https://cinesense-backend.onrender.com`)

---

## 5. Deployment Procedures (When Approved)

When you type **`APPROVED, PUSH`**, the following commands will be executed:
1. Merge `upgrade/full-overhaul` into `main`.
2. Push `main` to GitHub (`origin main`).
3. Vercel will automatically trigger the frontend deployment.
4. Render will deploy the updated FastAPI backend (or you can trigger manual deploy from the Render dashboard).
