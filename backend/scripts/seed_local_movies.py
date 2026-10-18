#!/usr/bin/env python3
"""
seed_local_movies.py — Seed local database with popular and candidate movies.
Works with both SQLite (sqlite+aiosqlite:///cinesense_local.db) and PostgreSQL.
Creates tables if missing and seeds ~100 movies from TMDB and FAISS id_map.
"""
import os
import sys
import asyncio
import logging
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.database import engine, Base, AsyncSessionLocal
from app.models.movie import Movie
from app.services.tmdb_service import _tmdb_get_async

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


async def seed_movies():
    print("[*] Initializing local database schema...", flush=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Schema initialized.", flush=True)

    print("[*] Fetching movies from TMDB...", flush=True)
    raw_movies = []
    for page in range(1, 5):
        t_data = await _tmdb_get_async("/trending/movie/week", {"page": page})
        if t_data and "results" in t_data:
            raw_movies.extend(t_data["results"])
        p_data = await _tmdb_get_async("/movie/popular", {"page": page})
        if p_data and "results" in p_data:
            raw_movies.extend(p_data["results"])
        tr_data = await _tmdb_get_async("/movie/top_rated", {"page": page})
        if tr_data and "results" in tr_data:
            raw_movies.extend(tr_data["results"])

    # Deduplicate by ID
    seen_ids = set()
    unique_movies = []
    for m in raw_movies:
        if m["id"] not in seen_ids:
            seen_ids.add(m["id"])
            unique_movies.append(m)

    print(f"Found {len(unique_movies)} candidate movies to seed.", flush=True)

    async with AsyncSessionLocal() as session:
        added_count = 0
        for m in unique_movies:
            # Check if movie already exists
            existing = await session.get(Movie, m["id"])
            if existing:
                continue

            release_date = None
            if m.get("release_date"):
                try:
                    release_date = datetime.strptime(m["release_date"], "%Y-%m-%d").date()
                except Exception:
                    pass

            genre_dicts = [{"id": gid, "name": "Genre"} for gid in m.get("genre_ids", [])]

            db_movie = Movie(
                id=m["id"],
                title=m.get("title", "Unknown"),
                overview=m.get("overview", ""),
                tagline=m.get("tagline"),
                genres=genre_dicts,
                keywords=[],
                poster_path=m.get("poster_path"),
                backdrop_path=m.get("backdrop_path"),
                vote_average=float(m.get("vote_average", 0.0)),
                vote_count=int(m.get("vote_count", 0)),
                release_date=release_date,
                trailer_key=None,
                watch_providers=None,
                cast_crew=None,
                belongs_to_collection=None,
                embedding_id=None,
            )
            session.add(db_movie)
            added_count += 1

        await session.commit()
        print(f"[OK] Successfully seeded {added_count} movies into local database!", flush=True)


if __name__ == "__main__":
    asyncio.run(seed_movies())
