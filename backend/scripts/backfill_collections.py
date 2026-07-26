import asyncio
import logging
import sys
from pathlib import Path

# Add backend to path so we can import app
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.database import AsyncSessionLocal
from app.models.movie import Movie
from app.services.tmdb_service import _tmdb_get_async
from sqlalchemy import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_collections():
    logger.info("Starting collection backfill...")
    async with AsyncSessionLocal() as session:
        # Get all movies that don't have belongs_to_collection set yet
        result = await session.execute(
            select(Movie).where(Movie.belongs_to_collection.is_(None))
        )
        movies = result.scalars().all()
        
        logger.info(f"Found {len(movies)} movies to check.")
        
        updated_count = 0
        for i, movie in enumerate(movies):
            try:
                # Fetch fresh details from TMDB
                details = await _tmdb_get_async(f"/movie/{movie.id}")
                if details and "belongs_to_collection" in details and details["belongs_to_collection"]:
                    collection_data = {
                        "id": details["belongs_to_collection"]["id"],
                        "name": details["belongs_to_collection"]["name"],
                        "poster_path": details["belongs_to_collection"].get("poster_path"),
                        "backdrop_path": details["belongs_to_collection"].get("backdrop_path")
                    }
                    movie.belongs_to_collection = collection_data
                    updated_count += 1
                    logger.info(f"Updated {movie.title} -> Collection: {collection_data['name']}")
                
                # Small delay to avoid hammering the TMDB API too hard
                await asyncio.sleep(0.05)
                
                # Commit in batches of 50
                if i > 0 and i % 50 == 0:
                    await session.commit()
                    logger.info(f"Processed {i}/{len(movies)}")
                    
            except Exception as e:
                logger.error(f"Error processing movie {movie.id} ({movie.title}): {e}")
        
        # Final commit
        await session.commit()
        logger.info(f"Backfill complete! Updated {updated_count} movies with collection data.")

if __name__ == "__main__":
    asyncio.run(backfill_collections())
