#!/usr/bin/env python3
"""
ingest_multilingual_movies.py — Resumable, rate-limited multilingual movie ingestion.
Expands catalog targeting Indian regional cinema (Hindi, Tamil, Telugu, Malayalam, Kannada,
Bengali, Marathi, Punjabi) and international cinema (Korean, Japanese, Spanish, French, English).
Computes Bayesian cohort quality scores per language.
Stores lean records (top 5 cast + director) without full crew bloat.
"""
import os
import sys
import json
import time
import math
import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Set, Any
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy import select, func, update
from app.database import engine, Base, AsyncSessionLocal
from app.models.movie import Movie
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CONCURRENCY = 20
REQUEST_TIMEOUT = 12.0
BATCH_COMMIT_SIZE = 50

# Target language quotas
TARGET_QUOTAS = {
    "hi": 1200,  # Hindi
    "ta": 600,   # Tamil
    "te": 600,   # Telugu
    "ml": 500,   # Malayalam
    "kn": 300,   # Kannada
    "bn": 200,   # Bengali
    "mr": 200,   # Marathi
    "pa": 200,   # Punjabi
    "ko": 500,   # Korean
    "ja": 300,   # Japanese
    "es": 300,   # Spanish
    "fr": 300,   # French
}

INDIAN_LANGUAGES = {"hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu"}

TMDB_GENRE_MAP = {
    28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime",
    99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History",
    27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance",
    878: "Science Fiction", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western"
}

total_tmdb_calls = 0


async def fetch_tmdb(client: httpx.AsyncClient, sem: asyncio.Semaphore, endpoint: str, params: dict) -> Optional[dict]:
    global total_tmdb_calls
    url = f"{settings.TMDB_BASE_URL}{endpoint}"
    full_params = {"api_key": settings.TMDB_API_KEY, **params}
    for attempt in range(3):
        async with sem:
            try:
                total_tmdb_calls += 1
                resp = await client.get(url, params=full_params, timeout=REQUEST_TIMEOUT)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 404:
                    return None
                elif resp.status_code == 429:
                    retry_sec = float(resp.headers.get("Retry-After", 1.5 * (attempt + 1)))
                    await asyncio.sleep(retry_sec)
                    continue
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
    return None


async def discover_language_candidates(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    lang: str,
    target_count: int,
    existing_ids: Set[int]
) -> List[dict]:
    """Discover candidates for a given language using popularity and vote_average sorts."""
    candidates = {}
    pages_to_fetch = min(25, math.ceil(target_count / 15))

    sort_strategies = ["popularity.desc", "vote_count.desc"]
    for sort_by in sort_strategies:
        for page in range(1, pages_to_fetch + 1):
            if len(candidates) >= target_count * 1.5:
                break
            params = {
                "with_original_language": lang,
                "sort_by": sort_by,
                "page": page,
                "include_adult": "false",
                "vote_count.gte": 5 if lang in INDIAN_LANGUAGES else 15,
            }
            if lang in INDIAN_LANGUAGES:
                params["with_origin_country"] = "IN"

            data = await fetch_tmdb(client, sem, "/discover/movie", params)
            if not data or "results" not in data:
                break
            results = data["results"]
            if not results:
                break
            for m in results:
                mid = m["id"]
                if mid not in candidates:
                    candidates[mid] = m

    logger.info(f"Language [{lang}]: Discovered {len(candidates)} candidates from TMDB")
    return list(candidates.values())


async def hydrate_movie_details(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    movie_id: int,
    include_credits: bool = True
) -> Optional[dict]:
    """Fetch movie details. Includes credits and keywords for new movies, omits for backfills."""
    params = {"append_to_response": "credits,keywords"} if include_credits else {}
    return await fetch_tmdb(client, sem, f"/movie/{movie_id}", params)


async def backfill_existing_movies(client: httpx.AsyncClient, sem: asyncio.Semaphore):
    """Backfill missing language, original_title, popularity, origin_country for existing rows."""
    logger.info("Checking existing movies needing language backfill...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Movie.id).where(Movie.original_language.is_(None))
        )
        to_backfill_ids = list(result.scalars().all())

    logger.info(f"Found {len(to_backfill_ids)} existing movies needing backfill")
    if not to_backfill_ids:
        return

    # Hydrate in batches using lean endpoint without credits (already have cast_crew)
    for b_idx in range(0, len(to_backfill_ids), BATCH_COMMIT_SIZE):
        batch = to_backfill_ids[b_idx : b_idx + BATCH_COMMIT_SIZE]
        tasks = [hydrate_movie_details(client, sem, mid, include_credits=False) for mid in batch]
        results = await asyncio.gather(*tasks)

        async with AsyncSessionLocal() as session:
            for mid, details in zip(batch, results):
                if not details:
                    continue
                orig_lang = details.get("original_language") or "en"
                orig_title = details.get("original_title") or details.get("title")
                pop = float(details.get("popularity", 0.0) or 0.0)
                origin_c = details.get("origin_country") or []
                if not origin_c and orig_lang in INDIAN_LANGUAGES:
                    origin_c = ["IN"]
                spoken_l = [s.get("iso_639_1") for s in details.get("spoken_languages", []) if isinstance(s, dict)]
                
                stmt = (
                    update(Movie)
                    .where(Movie.id == mid)
                    .values(
                        original_language=orig_lang,
                        original_title=orig_title,
                        popularity=pop,
                        origin_country=origin_c,
                        spoken_languages=spoken_l,
                    )
                )
                await session.execute(stmt)
            await session.commit()
        logger.info(f"Backfill progress: {min(b_idx + BATCH_COMMIT_SIZE, len(to_backfill_ids))}/{len(to_backfill_ids)}")


def parse_movie_record(details: dict, raw_fallback: Optional[dict] = None) -> dict:
    """Parse movie details into lean database columns."""
    d = details or raw_fallback or {}
    movie_id = d.get("id")
    title = d.get("title") or d.get("name") or "Unknown"
    original_title = d.get("original_title") or title
    original_language = d.get("original_language") or "en"
    
    release_date = None
    if d.get("release_date"):
        try:
            release_date = datetime.strptime(d["release_date"][:10], "%Y-%m-%d").date()
        except Exception:
            pass

    genres = []
    if "genres" in d and d["genres"]:
        genres = [{"id": g["id"], "name": g["name"]} for g in d["genres"] if isinstance(g, dict)]
    elif "genre_ids" in d and d["genre_ids"]:
        genres = [{"id": gid, "name": TMDB_GENRE_MAP.get(gid, "Unknown")} for gid in d["genre_ids"]]

    keywords = []
    kw_data = (d.get("keywords") or {}).get("keywords", [])
    if isinstance(kw_data, list):
        keywords = [k.get("name") for k in kw_data if isinstance(k, dict) and k.get("name")][:15]

    cast_crew = {"cast": [], "director": None}
    credits_data = d.get("credits") or {}
    cast_list = credits_data.get("cast", [])
    if isinstance(cast_list, list):
        cast_crew["cast"] = [c.get("name") for c in cast_list[:5] if isinstance(c, dict) and c.get("name")]
    crew_list = credits_data.get("crew", [])
    if isinstance(crew_list, list):
        for c in crew_list:
            if isinstance(c, dict) and c.get("job") == "Director":
                cast_crew["director"] = c.get("name")
                break

    spoken_languages = [s.get("iso_639_1") for s in d.get("spoken_languages", []) if isinstance(s, dict) and s.get("iso_639_1")]
    origin_country = d.get("origin_country") or []
    if not origin_country and original_language in INDIAN_LANGUAGES:
        origin_country = ["IN"]

    return {
        "id": movie_id,
        "title": title,
        "original_title": original_title,
        "original_language": original_language,
        "origin_country": origin_country,
        "spoken_languages": spoken_languages,
        "overview": d.get("overview") or "",
        "tagline": d.get("tagline"),
        "genres": genres,
        "keywords": keywords,
        "poster_path": d.get("poster_path"),
        "backdrop_path": d.get("backdrop_path"),
        "runtime": d.get("runtime"),
        "vote_average": float(d.get("vote_average", 0.0) or 0.0),
        "vote_count": int(d.get("vote_count", 0) or 0),
        "popularity": float(d.get("popularity", 0.0) or 0.0),
        "release_date": release_date,
        "cast_crew": cast_crew,
    }


async def ingest_new_language_movies(client: httpx.AsyncClient, sem: asyncio.Semaphore):
    """Ingest new movies per target language up to quotas."""
    async with AsyncSessionLocal() as session:
        # Check current counts per language
        result = await session.execute(
            select(Movie.original_language, func.count(Movie.id)).group_by(Movie.original_language)
        )
        current_counts = dict(result.all())

        all_ids_res = await session.execute(select(Movie.id))
        existing_ids = set(all_ids_res.scalars().all())

    logger.info(f"Current language distribution in database: {current_counts}")

    for lang, quota in TARGET_QUOTAS.items():
        curr = current_counts.get(lang, 0)
        needed = max(0, quota - curr)
        logger.info(f"Language [{lang}]: Current={curr}, Target={quota}, Needed={needed}")
        if needed <= 0:
            continue

        candidates = await discover_language_candidates(client, sem, lang, needed, existing_ids)
        new_candidates = [c for c in candidates if c["id"] not in existing_ids][:needed]

        logger.info(f"Language [{lang}]: Hydrating {len(new_candidates)} new movies...")
        
        for b_idx in range(0, len(new_candidates), BATCH_COMMIT_SIZE):
            batch = new_candidates[b_idx : b_idx + BATCH_COMMIT_SIZE]
            detail_tasks = [hydrate_movie_details(client, sem, m["id"]) for m in batch]
            details_results = await asyncio.gather(*detail_tasks)

            async with AsyncSessionLocal() as session:
                for raw_m, det in zip(batch, details_results):
                    parsed = parse_movie_record(det, raw_fallback=raw_m)
                    if parsed["id"] in existing_ids:
                        continue
                    
                    movie = Movie(
                        id=parsed["id"],
                        title=parsed["title"],
                        original_title=parsed["original_title"],
                        original_language=parsed["original_language"],
                        origin_country=parsed["origin_country"],
                        spoken_languages=parsed["spoken_languages"],
                        overview=parsed["overview"],
                        tagline=parsed["tagline"],
                        genres=parsed["genres"],
                        keywords=parsed["keywords"],
                        poster_path=parsed["poster_path"],
                        backdrop_path=parsed["backdrop_path"],
                        runtime=parsed["runtime"],
                        vote_average=parsed["vote_average"],
                        vote_count=parsed["vote_count"],
                        popularity=parsed["popularity"],
                        release_date=parsed["release_date"],
                        cast_crew=parsed["cast_crew"],
                        trailer_key=None,
                        watch_providers=None,
                        belongs_to_collection=None,
                        embedding_id=None,
                    )
                    session.add(movie)
                    existing_ids.add(parsed["id"])
                await session.commit()
            logger.info(f"  Inserted {min(b_idx + BATCH_COMMIT_SIZE, len(new_candidates))}/{len(new_candidates)} for {lang}")


async def compute_bayesian_cohort_quality_scores():
    """
    Computes Bayesian weighted rating for each movie within its original_language cohort:
    WR = (v / (v + m)) * R + (m / (v + m)) * C
    where:
      v = movie vote_count
      R = movie vote_average
      C = mean vote_average for that language cohort
      m = 40th percentile of vote_count for that language cohort (floor: 10 for Indian, 25 for others)
    """
    logger.info("Computing Bayesian cohort quality scores...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Movie.id, Movie.original_language, Movie.vote_average, Movie.vote_count))
        movies_data = result.all()

    # Group by language
    cohorts: Dict[str, List[dict]] = {}
    for mid, lang, r, v in movies_data:
        l = lang or "en"
        cohorts.setdefault(l, []).append({
            "id": mid,
            "vote_average": float(r or 0.0),
            "vote_count": int(v or 0)
        })

    updates = []
    cohort_stats = {}
    for lang, m_list in cohorts.items():
        vote_counts = [m["vote_count"] for m in m_list]
        ratings = [m["vote_average"] for m in m_list if m["vote_count"] > 0]
        
        C = float(np.mean(ratings)) if ratings else 6.5
        min_m = 10 if lang in INDIAN_LANGUAGES else 25
        p40 = float(np.percentile(vote_counts, 40)) if vote_counts else min_m
        m_thresh = max(min_m, p40)

        cohort_stats[lang] = {"count": len(m_list), "mean_rating": round(C, 2), "m_floor": round(m_thresh, 1)}

        for m in m_list:
            v = m["vote_count"]
            R = m["vote_average"]
            wr = (v / (v + m_thresh)) * R + (m_thresh / (v + m_thresh)) * C
            updates.append({"id": m["id"], "score": round(wr, 3)})

    logger.info(f"Cohort Parameters: {cohort_stats}")

    # Commit scores in batches
    for b_idx in range(0, len(updates), 500):
        batch = updates[b_idx : b_idx + 500]
        async with AsyncSessionLocal() as session:
            for item in batch:
                await session.execute(
                    update(Movie).where(Movie.id == item["id"]).values(cohort_quality_score=item["score"])
                )
            await session.commit()

    logger.info(f"Bayesian cohort quality scores updated for {len(updates)} movies.")


async def main():
    t_start = time.perf_counter()
    logger.info("=" * 70)
    logger.info("Starting CineSense Multilingual Movie Ingestion Pipeline")
    logger.info("=" * 70)

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        # Step 1: Backfill existing
        await backfill_existing_movies(client, sem)

        # Step 2: Ingest new movies per language
        await ingest_new_language_movies(client, sem)

    # Step 3: Compute Bayesian cohort quality scores
    await compute_bayesian_cohort_quality_scores()

    # Step 4: Final verification and counts
    async with AsyncSessionLocal() as session:
        res = await session.execute(
            select(Movie.original_language, func.count(Movie.id)).group_by(Movie.original_language).order_by(func.count(Movie.id).desc())
        )
        final_counts = res.all()
        total_res = await session.execute(select(func.count(Movie.id)))
        total_movies = total_res.scalar()

    dur = time.perf_counter() - t_start
    db_path = Path("cinesense_local.db")
    db_size_mb = db_path.stat().st_size / (1024 * 1024) if db_path.exists() else 0

    print("\n" + "=" * 70)
    print("🎬 INGESTION SUMMARY REPORT")
    print("=" * 70)
    print(f"Total Movies in Catalog: {total_movies}")
    print(f"Total TMDB API Calls:    {total_tmdb_calls}")
    print(f"Total Duration:          {dur:.1f}s ({dur / 60:.1f}m)")
    print(f"Local Database Size:     {db_size_mb:.2f} MB")
    print("\nFinal Language Distribution:")
    for lang, cnt in final_counts:
        print(f"  • {lang or 'unknown':8s}: {cnt:5d} movies")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
