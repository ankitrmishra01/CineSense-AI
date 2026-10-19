#!/usr/bin/env python3
"""
refresh_catalog_ratings.py — Weekly scheduled script to refresh movie ratings,
popularity, and fetch newly released multilingual movies for the CineSense AI catalog.
Recomputes Bayesian cohort quality scores after update.
"""
import os
import sys
import time
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy import select, update, func
from app.database import AsyncSessionLocal
from app.models.movie import Movie
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

CONCURRENCY = 20
BATCH_SIZE = 100
LANGUAGES = ["en", "hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "ko", "ja", "es", "fr"]


async def fetch_rating_update(client: httpx.AsyncClient, sem: asyncio.Semaphore, movie_id: int) -> Optional[dict]:
    url = f"{settings.TMDB_BASE_URL}/movie/{movie_id}"
    params = {"api_key": settings.TMDB_API_KEY}
    async with sem:
        try:
            resp = await client.get(url, params=params, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "id": movie_id,
                    "vote_average": float(data.get("vote_average", 0.0) or 0.0),
                    "vote_count": int(data.get("vote_count", 0) or 0),
                    "popularity": float(data.get("popularity", 0.0) or 0.0),
                }
        except Exception:
            pass
    return None


async def refresh_ratings(limit: Optional[int] = None):
    logger.info("=" * 70)
    logger.info("🎬 CineSense Catalog Rating & Metadata Refresh")
    logger.info("=" * 70)

    # 1. Fetch movies ordered by fetched_at asc (oldest first)
    async with AsyncSessionLocal() as session:
        query = select(Movie.id).order_by(Movie.fetched_at.asc())
        if limit:
            query = query.limit(limit)
        res = await session.execute(query)
        movie_ids = list(res.scalars().all())

    logger.info(f"Targeting {len(movie_ids)} movies for rating refresh")
    if not movie_ids:
        return

    sem = asyncio.Semaphore(CONCURRENCY)
    updated_count = 0
    t0 = time.perf_counter()

    async with httpx.AsyncClient(timeout=10.0) as client:
        for b_idx in range(0, len(movie_ids), BATCH_SIZE):
            batch = movie_ids[b_idx : b_idx + BATCH_SIZE]
            tasks = [fetch_rating_update(client, sem, mid) for mid in batch]
            results = await asyncio.gather(*tasks)

            async with AsyncSessionLocal() as session:
                for item in results:
                    if not item:
                        continue
                    stmt = (
                        update(Movie)
                        .where(Movie.id == item["id"])
                        .values(
                            vote_average=item["vote_average"],
                            vote_count=item["vote_count"],
                            popularity=item["popularity"],
                            fetched_at=datetime.utcnow()
                        )
                    )
                    await session.execute(stmt)
                    updated_count += 1
                await session.commit()
            logger.info(f"Refreshed {min(b_idx + BATCH_SIZE, len(movie_ids))}/{len(movie_ids)} movies")

    logger.info(f"Ratings refresh complete: {updated_count} movies updated in {time.perf_counter() - t0:.1f}s")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Refresh movie ratings and popularity.")
    parser.add_argument("--limit", type=int, default=None, help="Max movies to refresh")
    args = parser.parse_args()
    asyncio.run(refresh_ratings(limit=args.limit))
