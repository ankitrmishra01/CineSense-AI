#!/usr/bin/env python3
"""
fetch_movies.py — TMDB data pipeline (async + concurrent version)
Fetches ~2,000 popular/top-rated movies from TMDB and inserts into Postgres.

Uses asyncio + httpx with a semaphore to run ~10 concurrent detail requests,
cutting runtime from 5-6 hours down to ~15-20 minutes.

Usage:
    cd backend
    python scripts/fetch_movies.py
"""
import os
import sys
import asyncio
import logging
from datetime import date
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import httpx
from tqdm import tqdm
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.movie import Movie

logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

TMDB_BASE        = settings.TMDB_BASE_URL
API_KEY          = settings.TMDB_API_KEY
DISCOVER_PAGES   = 50          # 50 pages × 20 = 1,000 movies per sort strategy → ~2,000 total
CONCURRENT_LIMIT = 10          # max simultaneous TMDB detail requests
REQUEST_TIMEOUT  = 20

engine  = create_engine(settings.SYNC_DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)


async def tmdb_get_async(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    path: str,
    params: dict = None,
    retries: int = 3,
) -> Optional[dict]:
    url = f"{TMDB_BASE}{path}"
    p   = {"api_key": API_KEY, **(params or {})}
    async with semaphore:
        for attempt in range(retries):
            try:
                resp = await client.get(url, params=p, timeout=REQUEST_TIMEOUT)
                if resp.status_code == 429:
                    retry_after = int(resp.headers.get("Retry-After", 5))
                    await asyncio.sleep(retry_after)
                    continue
                resp.raise_for_status()
                return resp.json()
            except httpx.TimeoutException:
                if attempt == retries - 1:
                    return None
                await asyncio.sleep(2 ** attempt)
            except Exception:
                if attempt == retries - 1:
                    return None
                await asyncio.sleep(2 ** attempt)
    return None


async def fetch_discover_page_async(client, semaphore, page, sort_by):
    data = await tmdb_get_async(client, semaphore, "/discover/movie", {
        "sort_by": sort_by,
        "vote_count.gte": 100,
        "include_adult": "false",
        "page": page,
    })
    return data.get("results", []) if data else []


async def fetch_movie_details_async(client, semaphore, movie_id):
    return await tmdb_get_async(
        client, semaphore,
        f"/movie/{movie_id}",
        {"append_to_response": "keywords,videos,watch/providers"},
    )


def extract_trailer_key(details):
    videos = (details.get("videos") or {}).get("results", [])
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer" and v.get("official"):
            return v["key"]
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer":
            return v["key"]
    return None


def extract_keywords(details):
    kws = (details.get("keywords") or {}).get("keywords", [])
    return [k["name"] for k in kws[:30]]


def extract_watch_providers(details):
    return (details.get("watch/providers") or {}).get("results", {})


def parse_release_date(date_str):
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except ValueError:
        return None


def upsert_movie(session, details):
    movie_id  = details["id"]
    existing  = session.get(Movie, movie_id)
    fields = dict(
        title          = details.get("title", ""),
        overview       = details.get("overview"),
        tagline        = details.get("tagline"),
        genres         = details.get("genres"),
        keywords       = extract_keywords(details),
        poster_path    = details.get("poster_path"),
        backdrop_path  = details.get("backdrop_path"),
        runtime        = details.get("runtime"),
        vote_average   = details.get("vote_average"),
        vote_count     = details.get("vote_count"),
        release_date   = parse_release_date(details.get("release_date")),
        trailer_key    = extract_trailer_key(details),
        watch_providers= extract_watch_providers(details),
    )
    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
    else:
        session.add(Movie(id=movie_id, **fields))


async def main_async():
    if not API_KEY:
        print("ERROR: TMDB_API_KEY is not set in .env")
        sys.exit(1)

    print("Creating tables if needed...")
    Base.metadata.create_all(engine)

    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)
    limits    = httpx.Limits(max_connections=20, max_keepalive_connections=10)

    async with httpx.AsyncClient(limits=limits) as client:

        # Phase 1: Discover movie IDs (all pages concurrently)
        sort_strategies = ["popularity.desc", "vote_average.desc"]
        movie_ids_seen: set[int] = set()
        all_ids: list[int] = []

        for sort_by in sort_strategies:
            print(f"\nDiscovering: {sort_by} ({DISCOVER_PAGES} pages)...")
            tasks = [
                fetch_discover_page_async(client, semaphore, page, sort_by)
                for page in range(1, DISCOVER_PAGES + 1)
            ]
            pages = await asyncio.gather(*tasks)
            for results in pages:
                for r in results:
                    mid = r["id"]
                    if mid not in movie_ids_seen:
                        movie_ids_seen.add(mid)
                        all_ids.append(mid)

        print(f"\nTotal unique movies to fetch: {len(all_ids)}")

        # Phase 2: Fetch full details concurrently in batches of 100
        session  = Session()
        inserted = 0
        errors   = 0
        BATCH    = 100

        pbar = tqdm(total=len(all_ids), desc="Fetching details", unit="movie")

        for batch_start in range(0, len(all_ids), BATCH):
            batch_ids    = all_ids[batch_start : batch_start + BATCH]
            detail_tasks = [fetch_movie_details_async(client, semaphore, mid) for mid in batch_ids]
            details_list = await asyncio.gather(*detail_tasks)

            for details in details_list:
                if not details:
                    errors += 1
                    pbar.update(1)
                    continue
                try:
                    upsert_movie(session, details)
                    inserted += 1
                except Exception as e:
                    logger.warning("Upsert failed: %s", e)
                    session.rollback()
                    errors += 1
                pbar.update(1)

            try:
                session.commit()
            except Exception as e:
                logger.error("Commit failed: %s", e)
                session.rollback()

        pbar.close()
        session.close()

    print(f"\n✅ Done! Inserted/updated: {inserted} | Errors: {errors}")
    print("Next step: python scripts/build_embeddings.py")


def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
