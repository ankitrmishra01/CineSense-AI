#!/usr/bin/env python3
"""
seed_local_movies.py — Seed local database with all movies in the FAISS id_map.
Works with both SQLite (sqlite+aiosqlite:///cinesense_local.db) and PostgreSQL.
Fully resumable, rate-limited, and chunked with commit checkpoints.

Usage:
    python scripts/seed_local_movies.py               # Seed all remaining movies
    python scripts/seed_local_movies.py --limit 500   # Seed up to 500 remaining movies
"""
import os
import sys
import json
import time
import asyncio
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy import select
from app.database import engine, Base, AsyncSessionLocal
from app.models.movie import Movie
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CONCURRENCY = 25
BATCH_SIZE = 100
REQUEST_TIMEOUT = 12.0


async def fetch_single_movie(client: httpx.AsyncClient, sem: asyncio.Semaphore, movie_id: int) -> Optional[dict]:
    url = f"{settings.TMDB_BASE_URL}/movie/{movie_id}"
    params = {"api_key": settings.TMDB_API_KEY}
    for attempt in range(3):
        async with sem:
            try:
                resp = await client.get(url, params=params, timeout=REQUEST_TIMEOUT)
                if resp.status_code == 200:
                    return resp.json()
                elif resp.status_code == 404:
                    return None
                elif resp.status_code == 429:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
            except Exception:
                await asyncio.sleep(0.5 * (attempt + 1))
    return None


async def seed_movies(limit: Optional[int] = None):
    print("=" * 70, flush=True)
    print("🎬 CineSense AI — Local Movie Catalog Seeder", flush=True)
    print("=" * 70, flush=True)

    # 1. Initialize schema
    print("[*] Initializing local database schema...", flush=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Schema ready.", flush=True)

    # 2. Load FAISS id_map
    id_map_path = Path(settings.FAISS_ID_MAP_PATH)
    if not id_map_path.exists():
        id_map_path = Path(__file__).resolve().parent.parent / settings.FAISS_ID_MAP_PATH
    if not id_map_path.exists():
        print(f"[ERR] id_map.json not found at {id_map_path}", flush=True)
        return

    with open(id_map_path, "r", encoding="utf-8") as f:
        all_ids = json.load(f)

    print(f"[*] Total movies in FAISS index id_map: {len(all_ids)}", flush=True)

    # 3. Query already existing movies in DB (Resumable)
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Movie.id))
        existing_ids = set(result.scalars().all())

    print(f"[*] Already present in local database: {len(existing_ids)}", flush=True)
    missing_ids = [mid for mid in all_ids if mid not in existing_ids]

    if limit and limit > 0:
        missing_ids = missing_ids[:limit]
        print(f"[*] Target limit specified: Seeding next {len(missing_ids)} movies...", flush=True)
    else:
        print(f"[*] Seeding all remaining {len(missing_ids)} movies...", flush=True)

    if not missing_ids:
        print("[OK] Database is already fully seeded with all FAISS movies!", flush=True)
        return

    # 4. Fetch and insert in batches
    sem = asyncio.Semaphore(CONCURRENCY)
    total_added = 0
    t_start = time.perf_counter()

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        for b_idx in range(0, len(missing_ids), BATCH_SIZE):
            chunk = missing_ids[b_idx : b_idx + BATCH_SIZE]
            t_chunk = time.perf_counter()

            tasks = [fetch_single_movie(client, sem, mid) for mid in chunk]
            results = await asyncio.gather(*tasks)

            # Insert batch into DB
            async with AsyncSessionLocal() as session:
                batch_added = 0
                for data in results:
                    if not data or "id" not in data:
                        continue

                    release_date = None
                    if data.get("release_date"):
                        try:
                            release_date = datetime.strptime(data["release_date"], "%Y-%m-%d").date()
                        except Exception:
                            pass

                    genres = [{"id": g["id"], "name": g["name"]} for g in data.get("genres", []) if isinstance(g, dict)]

                    movie = Movie(
                        id=data["id"],
                        title=data.get("title") or data.get("name") or "Unknown",
                        overview=data.get("overview") or "",
                        tagline=data.get("tagline"),
                        genres=genres,
                        keywords=[],
                        poster_path=data.get("poster_path"),
                        backdrop_path=data.get("backdrop_path"),
                        runtime=data.get("runtime"),
                        vote_average=float(data.get("vote_average", 0.0) or 0.0),
                        vote_count=int(data.get("vote_count", 0) or 0),
                        release_date=release_date,
                        trailer_key=None,
                        watch_providers=None,
                        cast_crew=None,
                        belongs_to_collection=None,
                        embedding_id=None,
                    )
                    session.add(movie)
                    batch_added += 1

                await session.commit()
                total_added += batch_added

            dur_chunk = time.perf_counter() - t_chunk
            elapsed = time.perf_counter() - t_start
            rate = total_added / max(elapsed, 0.001)
            print(
                f"  • Progress: {b_idx + len(chunk):4d}/{len(missing_ids)} seeded "
                f"({total_added} total added) | Rate: {rate:.1f} movies/s | Batch took {dur_chunk:.1f}s",
                flush=True,
            )

    print("=" * 70, flush=True)
    print(f"[OK] Completed seeding! Added {total_added} movies in {time.perf_counter() - t_start:.1f}s.", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed local movies catalog from TMDB and FAISS id_map.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of movies to seed.")
    args = parser.parse_args()
    asyncio.run(seed_movies(limit=args.limit))
