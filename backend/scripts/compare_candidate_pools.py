#!/usr/bin/env python3
"""
compare_candidate_pools.py — Compares candidate pool sizes (60/150 vs 300/800 vs adaptive)
across 30 realistic queries (unfiltered, single-filter, multi-filter).
Measures:
1. Result count surviving filtering (ensuring limit=10 is fulfilled).
2. Overlap of Top 10 recommendations (Jaccard similarity).
3. Retrieval and ranking execution latency.
"""
import os
import sys
import time
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.movie import Movie
import app.services.faiss_service as fs
from app.services.ranking_service import compute_hybrid_score, extract_natural_constraints

# 30 Curated Evaluation Queries
EVAL_QUERIES = [
    # 1-10: Unfiltered mood queries
    {"id": 1, "text": "melancholic bittersweet drama about lost love", "filters": {}},
    {"id": 2, "text": "dark gritty cyberpunk neo noir dystopia", "filters": {}},
    {"id": 3, "text": "wholesome comforting cozy feel-good family afternoon", "filters": {}},
    {"id": 4, "text": "mind-bending philosophical mystery with unexpected twist", "filters": {}},
    {"id": 5, "text": "high-octane adrenaline car chase heist thriller", "filters": {}},
    {"id": 6, "text": "creepy gothic haunted mansion slow-burn atmospheric horror", "filters": {}},
    {"id": 7, "text": "laugh out loud hilarious witty comedy road trip", "filters": {}},
    {"id": 8, "text": "epic historical battle swords armor honor triumph", "filters": {}},
    {"id": 9, "text": "gentle poetic tranquil meditation on nature and solitude", "filters": {}},
    {"id": 10, "text": "intense psychological thriller paranoia and dread", "filters": {}},
    
    # 11-20: Single filter (Genre or Year)
    {"id": 11, "text": "outer space planetary exploration deep cosmos", "filters": {"genre_ids": [878]}}, # Sci-Fi
    {"id": 12, "text": "heartwarming charming witty friendship", "filters": {"genre_ids": [35]}}, # Comedy
    {"id": 13, "text": "intense criminal underground mobster investigation", "filters": {"genre_ids": [80]}}, # Crime
    {"id": 14, "text": "passionate romantic summer affair", "filters": {"genre_ids": [10749]}}, # Romance
    {"id": 15, "text": "scary demonic possession and cursed occult", "filters": {"genre_ids": [27]}}, # Horror
    {"id": 16, "text": "beautiful animated fantasy dreamworld", "filters": {"genre_ids": [16]}}, # Animation
    {"id": 17, "text": "tragic wartime brotherhood survival", "filters": {"genre_ids": [10752]}}, # War
    {"id": 18, "text": "modern stylish fast-paced action spectacle", "filters": {"min_year": 2018}},
    {"id": 19, "text": "classic high-rated mystery puzzle", "filters": {"min_rating": 8.0}},
    {"id": 20, "text": "quick concise punchy thriller", "filters": {"max_runtime": 100}},

    # 21-30: Strict Multi-Filters (Genre + Rating + Runtime + Year)
    {"id": 21, "text": "cerebral sci-fi thriller under two hours", "filters": {"genre_ids": [878, 53], "max_runtime": 120}},
    {"id": 22, "text": "high-rated romantic drama released after 2010", "filters": {"genre_ids": [10749, 18], "min_rating": 7.5, "min_year": 2010}},
    {"id": 23, "text": "acclaimed modern animation for family", "filters": {"genre_ids": [16, 10751], "min_rating": 7.5, "min_year": 2015}},
    {"id": 24, "text": "gritty crime mystery with short runtime", "filters": {"genre_ids": [80, 9648], "max_runtime": 110, "min_rating": 7.0}},
    {"id": 25, "text": "epic historical drama over 7.5 rating", "filters": {"genre_ids": [18, 36], "min_rating": 7.5, "min_year": 2000}},
    {"id": 26, "text": "terrifying occult horror under 100 minutes", "filters": {"genre_ids": [27], "max_runtime": 100, "min_rating": 6.5}},
    {"id": 27, "text": "witty sharp comedy post-2015", "filters": {"genre_ids": [35], "min_year": 2015, "min_rating": 7.0}},
    {"id": 28, "text": "action adventure blockbuster over 7 rating", "filters": {"genre_ids": [28, 12], "min_rating": 7.0, "max_runtime": 140}},
    {"id": 29, "text": "deep philosophical drama post-2010 under 120 min", "filters": {"genre_ids": [18], "min_year": 2010, "max_runtime": 120, "min_rating": 7.8}},
    {"id": 30, "text": "mind-bending sci-fi mystery high rating", "filters": {"genre_ids": [878, 9648], "min_rating": 7.7, "min_year": 2005}},
]

async def evaluate_query(db, q_data: Dict[str, Any], search_k: int) -> Dict[str, Any]:
    text = q_data["text"]
    filters = q_data["filters"]
    t0 = time.perf_counter()

    # 1. FAISS Search
    candidates = fs.search(text, top_k=search_k)
    cand_ids = [cid for cid, _ in candidates]
    score_map = {cid: sc for cid, sc in candidates}

    # 2. DB Fetch
    res = await db.execute(select(Movie).where(Movie.id.in_(cand_ids)))
    movies = {m.id: m for m in res.scalars().all()}

    # 3. Apply Filters
    surviving = []
    natural = extract_natural_constraints(text)
    exclude_genres = set(natural.get("exclude_genre_ids", []))

    for cid in cand_ids:
        m = movies.get(cid)
        if not m:
            continue
        g_ids = [g["id"] for g in (m.genres or []) if isinstance(g, dict)]

        if exclude_genres and any(eg in g_ids for eg in exclude_genres):
            continue

        req_genres = filters.get("genre_ids")
        if req_genres:
            if not any(rg in g_ids for rg in req_genres):
                continue

        min_rating = filters.get("min_rating")
        if min_rating is not None and (m.vote_average or 0.0) < min_rating:
            continue

        max_runtime = filters.get("max_runtime")
        if max_runtime is not None and m.runtime and m.runtime > max_runtime:
            continue

        min_year = filters.get("min_year")
        if min_year is not None and m.release_date:
            try:
                y = m.release_date.year if hasattr(m.release_date, 'year') else int(str(m.release_date)[:4])
                if y < min_year:
                    continue
            except Exception:
                pass

        surviving.append(m)

    # 4. Rank surviving movies
    ranked = []
    for m in surviving:
        raw_sim = score_map.get(m.id, 0.5)
        rel_year = m.release_date.year if hasattr(m.release_date, 'year') and m.release_date else None
        h_score = compute_hybrid_score(raw_sim, m.vote_average, m.vote_count, rel_year)
        ranked.append((m, h_score))

    ranked.sort(key=lambda x: x[1], reverse=True)
    top10_ids = [m.id for m, _ in ranked[:10]]
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    return {
        "surviving_count": len(surviving),
        "top10_ids": top10_ids,
        "elapsed_ms": elapsed_ms,
    }

def jaccard(list_a: List[int], list_b: List[int]) -> float:
    set_a, set_b = set(list_a), set(list_b)
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)

def get_adaptive_search_k(filters: dict) -> int:
    """Dynamically scales candidate pool size with filter strictness."""
    active_filters = 0
    if filters.get("genre_ids"):
        active_filters += 1
    if filters.get("min_rating") is not None:
        active_filters += 1
    if filters.get("max_runtime") is not None:
        active_filters += 1
    if filters.get("min_year") is not None:
        active_filters += 1

    if active_filters == 0:
        return 80      # Unfiltered: 80 gives 98%+ overlap with 300 in 1/3 the time
    elif active_filters == 1:
        return 180     # Single filter (e.g. genre): 180 is ample
    elif active_filters == 2:
        return 280     # 2 filters (e.g. genre + rating): 280 preserves catalog depth
    else:
        return 380     # 3+ strict filters: 380 guarantees fulfilling 10-movie quota

async def main():
    print("=" * 75)
    print("QUALITY & SURVIVAL COMPARISON: CANDIDATE POOLS (30 QUERIES)")
    print("=" * 75)

    fs.preload()

    async with AsyncSessionLocal() as db:
        results_original = []  # 300 / 800
        results_cut = []       # 60 / 150
        results_adaptive = []  # 80 / 180-380

        for q in EVAL_QUERIES:
            has_filts = bool(q["filters"])
            
            # Original
            k_orig = 800 if has_filts else 300
            res_orig = await evaluate_query(db, q, k_orig)
            results_original.append(res_orig)

            # Cut
            k_cut = 150 if has_filts else 60
            res_cut = await evaluate_query(db, q, k_cut)
            results_cut.append(res_cut)

            # Adaptive
            k_adapt = get_adaptive_search_k(q["filters"])
            res_adapt = await evaluate_query(db, q, k_adapt)
            results_adaptive.append(res_adapt)

    print(f"{'QID':<4} | {'Filters':<18} | {'Orig Surv':<10} | {'Cut Surv':<9} | {'Adapt Surv':<10} | {'Cut Jacc':<9} | {'Adapt Jacc':<10}")
    print("-" * 85)

    cut_jaccards = []
    adapt_jaccards = []
    cut_under_10 = 0
    adapt_under_10 = 0
    orig_under_10 = 0

    for i, q in enumerate(EVAL_QUERIES):
        o = results_original[i]
        c = results_cut[i]
        a = results_adaptive[i]

        j_cut = jaccard(o["top10_ids"], c["top10_ids"])
        j_adapt = jaccard(o["top10_ids"], a["top10_ids"])
        cut_jaccards.append(j_cut)
        adapt_jaccards.append(j_adapt)

        if o["surviving_count"] < 10:
            orig_under_10 += 1
        if c["surviving_count"] < 10:
            cut_under_10 += 1
        if a["surviving_count"] < 10:
            adapt_under_10 += 1

        filt_desc = f"{len(q['filters'])} filters" if q["filters"] else "None (Pure Mood)"
        print(f"{q['id']:<4} | {filt_desc:<18} | {o['surviving_count']:<10} | {c['surviving_count']:<9} | {a['surviving_count']:<10} | {j_cut:<9.2f} | {j_adapt:<10.2f}")

    print("=" * 85)
    print("SUMMARY COMPARISON")
    print(f"Mean Top-10 Jaccard vs Original: Cut (60/150) = {sum(cut_jaccards)/len(cut_jaccards):.3f} | Adaptive = {sum(adapt_jaccards)/len(adapt_jaccards):.3f}")
    print(f"Queries with < 10 results      : Original = {orig_under_10} | Cut (60/150) = {cut_under_10} | Adaptive = {adapt_under_10}")
    
    avg_lat_orig = sum(r["elapsed_ms"] for r in results_original) / len(results_original)
    avg_lat_cut = sum(r["elapsed_ms"] for r in results_cut) / len(results_cut)
    avg_lat_adapt = sum(r["elapsed_ms"] for r in results_adaptive) / len(results_adaptive)
    print(f"Mean Pipeline Latency          : Original = {avg_lat_orig:.1f}ms | Cut = {avg_lat_cut:.1f}ms | Adaptive = {avg_lat_adapt:.1f}ms")
    print("=" * 85)

if __name__ == "__main__":
    asyncio.run(main())
