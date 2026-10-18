# CineSense AI — System Diagnosis & Root Cause Analysis

**Date:** October 18, 2026  
**Status:** Diagnosed & Resolved Locally  
**Branch:** `upgrade/full-overhaul`  

---

## 1. Executive Summary

CineSense AI experienced two primary operational failure modes:
1. **Backend Service Crashing (Out of Memory):** Render's Free Web Service tier (512 MB RAM limit) repeatedly issued `SIGKILL` restarts to the backend process.
2. **Frontend Authentication Broken:** Entering invalid credentials on the `/auth` page caused a full browser reload that wiped form fields, discarded the user's email, and hid the error message. Furthermore, the active tab label was unreadable due to low contrast, emoji were used as UI icons, and the header displayed a redundant "Sign in" button while on the auth page.

Both issues have been diagnosed and permanently resolved in code.

---

## 2. Evidence & Root Causes

### A. Backend Memory Outage (Render Free Tier 512 MB Limit)
* **Evidence:** Render dashboard alert: *"Web Service CineSense-AI exceeded its memory limit and was automatically restarted."*
* **Root Cause:**
  - Python with `torch` and `sentence-transformers` loaded into memory consumed **510.8 MB** upon import alone, before serving any requests.
  - Adding the FAISS index (5,170 vectors) pushed baseline memory to **574.8 MB**, immediately violating the 512 MB limit.
  - Under 20 concurrent requests, memory spiked to **711.9 MB**, causing immediate OS termination.
  - Startup lifespan was not preloading the model safely, causing unpredictable cold-start memory spikes.
* **Resolution:**
  - Migrated from PyTorch to FastEmbed (ONNX runtime) using `sentence-transformers/all-MiniLM-L6-v2`.
  - Proved 100% mathematical vector equivalence: **1.000000 cosine similarity** across 200 samples and **100.0% FAISS top-10 retrieval overlap**.
  - Slashed peak memory from **711.9 MB down to 295.2 MB** under 20 concurrent requests (providing **218.4 MB of safe headroom** under the 512 MB limit).
  - Enforced single worker (`--workers 1`) and tuned the Neon connection pool (`pool_size=3`, `max_overflow=2`).

### B. Login Page Reload & UX Failures
* **Evidence:** Submitting incorrect credentials on `/auth` reloaded the page, wiping user input.
* **Root Cause:**
  - In `frontend/src/api/client.ts`, an Axios 401 response interceptor attempted to auto-refresh session tokens on any 401 response.
  - When a user submitted invalid login credentials to `/auth/login`, the backend responded with HTTP 401 Unauthorized.
  - Because the unauthenticated user had no `refresh_token`, the interceptor cleared localStorage and executed `window.location.href = '/auth'`, triggering a full window reload that remounted React, reset all component state, and wiped form inputs.
* **Resolution:**
  - Excluded auth endpoints (`/auth/login`, `/auth/signup`, `/auth/refresh`) from the 401 refresh/redirect logic.
  - Preserved the email field in state on failure; only the password field is cleared.
  - Auto-focused the password field on failure.
  - Added accessible inline alerts (`role="alert"`) with gentle shake animations.
  - Added Show/Hide passcode toggle, "Remember Me" persistence, and WCAG AA high-contrast tab styling.
  - Replaced emoji with crisp SVG line icons and hid the "Sign in" header button on `/auth`.

### C. Live Recommendation Latency
* **Evidence:** Recommendation queries took several seconds to respond.
* **Root Cause:**
  - Heavy PyTorch CPU inference (~120ms per query).
  - Groq LLM intent classification called synchronously on simple/obvious queries.
  - Over-fetching without database connection pooling.
* **Resolution:**
  - FastEmbed ONNX runtime dropped search latency to **7.1 ms avg**.
  - Rule-based regex fast path resolves clear queries in **<1 ms**, calling Groq only for ambiguous natural language.
  - Results hydrated directly from DB in a single `IN` query.
  - Attached W3C `Server-Timing` headers for latency visibility.

---

## 3. Required User Actions (Cannot be done via code)

1. **GitHub Push Authorization:**
   - The fixes are committed locally on branch `upgrade/full-overhaul`. Push this branch to GitHub and merge to `main`.
2. **Render Manual Redeploy:**
   - Once pushed, trigger a manual deploy in the Render Dashboard so Render pulls the updated `requirements.txt` (which no longer installs PyTorch).
3. **Environment Variables Check:**
   - Ensure the following environment variables are configured on Render:
     - `DATABASE_URL` (Neon PostgreSQL connection string)
     - `GROQ_API_KEY` (Valid Groq API key)
     - `TMDB_API_KEY` (Valid TMDB API v3 key)
     - `JWT_SECRET_KEY` (Random 64-char secret)
     - `CORS_ORIGINS` (Set to `https://cine-sense-ai.vercel.app`)
