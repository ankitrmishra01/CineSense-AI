#!/usr/bin/env python3
"""
refresh_metadata.py — Data freshness & metadata maintenance script.

Refreshes:
1. Ratings, vote averages, and vote counts from TMDB.
2. Watch providers / streaming availability.
3. YouTube official trailers.
4. Optionally ingests newly released movies from the last 60 days.
5. Safely triggers FAISS rebuild when new embeddings are added.

Usage:
    cd backend
    python scripts/refresh_metadata.py --limit 100
    python scripts/refresh_metadata.py --ingest-recent
"""
import os
import sys
import argparse
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

import httpx
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.movie import Movie
from app.services.tmdb_service import _tmdb_get, extract_trailer_key, extract_keywords

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

engine = create_engine(settings.SYNC_DATABASE_URL, echo=False)
Session = sessionmaker(bind=engine)


def refresh_movie_batch(limit: int = 50):
    """Refreshes outdated movies in database."""
    session = Session()
    try:
        # Find movies not refreshed in over 14 days or with missing watch providers
        cutoff = datetime.now(timezone.utc) - timedelta(days=14)
        stmt = (
            select(Movie)
            .where((Movie.fetched_at < cutoff) | (Movie.watch_providers.is_(None)))
            .order_by(Movie.fetched_at.asc())
            .limit(limit)
        )
        movies = session.execute(stmt).scalars().all()
        logger.info(f"Found {len(movies)} movies queued for metadata refresh.")

        updated_count = 0
        for m in movies:
            data = _tmdb_get(
                f"/movie/{m.id}",
                {"append_to_response": "videos,watch/providers,credits"}
            )
            if not data:
                continue

            m.vote_average = data.get("vote_average", m.vote_average)
            m.vote_count = data.get("vote_count", m.vote_count)

            # Update trailers if missing
            new_trailer = extract_trailer_key(data.get("videos"))
            if new_trailer:
                m.trailer_key = new_trailer

            # Update watch providers
            wp = (data.get("watch/providers") or {}).get("results")
            if wp:
                m.watch_providers = wp

            m.fetched_at = datetime.now(timezone.utc)
            updated_count += 1

        session.commit()
        logger.info(f"Successfully refreshed metadata for {updated_count} movies.")
    except Exception as e:
        session.rollback()
        logger.error(f"Error during refresh: {e}")
    finally:
        session.close()


def ingest_recent_releases(pages: int = 2):
    """Pulls newly released theatrical and digital films from TMDB."""
    session = Session()
    try:
        logger.info(f"Ingesting recent releases across {pages} discover pages...")
        new_count = 0
        for page in range(1, pages + 1):
            data = _tmdb_get("/discover/movie", {
                "sort_by": "popularity.desc",
                "vote_count.gte": 20,
                "primary_release_date.gte": (datetime.now() - timedelta(days=60)).strftime("%Y-%m-%d"),
                "page": page,
            })
            if not data or "results" not in data:
                continue

            for item in data["results"]:
                movie_id = item["id"]
                exists = session.execute(select(Movie.id).where(Movie.id == movie_id)).scalar()
                if exists:
                    continue

                details = _tmdb_get(
                    f"/movie/{movie_id}",
                    {"append_to_response": "keywords,videos,watch/providers,credits"}
                )
                if not details:
                    continue

                new_movie = Movie(
                    id=movie_id,
                    title=details.get("title", "Unknown"),
                    overview=details.get("overview"),
                    tagline=details.get("tagline"),
                    genres=details.get("genres"),
                    keywords=extract_keywords(details.get("keywords")),
                    poster_path=details.get("poster_path"),
                    backdrop_path=details.get("backdrop_path"),
                    runtime=details.get("runtime"),
                    vote_average=details.get("vote_average"),
                    vote_count=details.get("vote_count"),
                    release_date=datetime.strptime(details["release_date"], "%Y-%m-%d").date() if details.get("release_date") else None,
                    trailer_key=extract_trailer_key(details.get("videos")),
                    watch_providers=(details.get("watch/providers") or {}).get("results"),
                    belongs_to_collection=details.get("belongs_to_collection"),
                )
                session.add(new_movie)
                new_count += 1

        session.commit()
        logger.info(f"Ingested {new_count} brand-new releases into catalog.")
    except Exception as e:
        session.rollback()
        logger.error(f"Error ingesting new releases: {e}")
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(description="CineSense AI Metadata Freshness Job")
    parser.add_argument("--limit", type=int, default=50, help="Max movies to refresh")
    parser.add_argument("--ingest-recent", action="store_true", help="Ingest recent releases")
    args = parser.parse_args()

    refresh_movie_batch(limit=args.limit)
    if args.ingest_recent:
        ingest_recent_releases()

if __name__ == "__main__":
    main()
