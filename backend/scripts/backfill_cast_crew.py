import asyncio
import logging
import sys
from pathlib import Path
import httpx
from tqdm import tqdm
from sqlalchemy import select

# Add backend to path so we can import app
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal
from app.models.movie import Movie
from app.services.tmdb_service import _tmdb_get_async

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_cast_crew():
    logger.info("Starting cast/crew backfill...")
    async with AsyncSessionLocal() as session:
        # Get all movies that don't have cast_crew set yet (resumable)
        result = await session.execute(
            select(Movie).where(Movie.cast_crew.is_(None))
        )
        movies = result.scalars().all()
        
        logger.info(f"Found {len(movies)} movies to process.")
        if not movies:
            return

        async with httpx.AsyncClient() as client:
            for i, movie in enumerate(tqdm(movies)):
                try:
                    response = await client.get(
                        f"https://api.themoviedb.org/3/movie/{movie.id}/credits",
                        params={"api_key": "c39cf9b045601e9519b0d470702d6767"},
                        timeout=15
                    )
                    if response.status_code == 200:
                        data = response.json()
                        # Extract top 10 cast members
                        cast = []
                        for c in data.get("cast", [])[:10]:
                            cast.append({
                                "id": c.get("id"),
                                "name": c.get("name"),
                                "character": c.get("character"),
                                "order": c.get("order")
                            })
                        
                        # Extract Director and Writer from crew
                        crew = []
                        for c in data.get("crew", []):
                            if c.get("job") in ["Director", "Writer"]:
                                crew.append({
                                    "id": c.get("id"),
                                    "name": c.get("name"),
                                    "job": c.get("job")
                                })
                        
                        movie.cast_crew = {
                            "cast": cast,
                            "crew": crew
                        }
                        
                        # Commit every 50 movies to save progress
                        if i > 0 and i % 50 == 0:
                            await session.commit()
                            
                    # Delay to respect TMDB rate limit (similar to existing logic)
                    await asyncio.sleep(0.05)
                except Exception as e:
                    logger.error(f"Error processing movie {movie.id}: {e}")
                    # Continue despite error
            
            # Final commit
            await session.commit()
            logger.info("Finished cast/crew backfill!")

if __name__ == "__main__":
    asyncio.run(backfill_cast_crew())
