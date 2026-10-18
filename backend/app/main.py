import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import text
from app.config import settings
from app.middleware import add_middleware
from app.routers import auth_router, recommend_router, movies_router, watchlist_router
from app.services import faiss_preload

logger = logging.getLogger("cinesense.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup self-checks:
    logger.info("🎬 CineSense AI Backend Startup Self-Check...")
    
    # 1. Warm up FAISS index + FastEmbed ONNX model
    try:
        faiss_preload()
        from app.services.faiss_service import get_faiss_stats
        f_stats = get_faiss_stats()
        logger.info("✓ FAISS Index loaded: %d items, dim %s, model: %s", 
                    f_stats.get("total_movies", 0), f_stats.get("dimension"), f_stats.get("model"))
    except Exception as e:
        logger.error("✗ Failed to load FAISS index or FastEmbed model: %s", e)

    # 2. Check Database connectivity and movie count
    from app.database import engine
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT count(*) FROM movies"))
            count = result.scalar() or 0
            if count == 0:
                logger.warning("⚠ Database connected, but 'movies' table has 0 rows. Run 'python scripts/seed_local_movies.py' to seed titles.")
            else:
                logger.info("✓ Database connected. Total catalog titles: %d", count)
    except Exception as e:
        logger.warning("⚠ Database not reachable (%s). Backend running in resilient TMDB-direct fallback mode.", e)

    yield

    # Shutdown: clean up DB connections
    try:
        await engine.dispose()
    except Exception:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    description="Emotion-aware movie discovery platform",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "cinesense-backend"}


@app.get("/health/detailed", tags=["Health"])
async def detailed_health():
    from app.services.faiss_service import get_faiss_stats
    from app.database import engine

    faiss_info = get_faiss_stats()

    db_status = "unknown"
    movie_count = 0
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT count(*) FROM movies"))
            movie_count = result.scalar() or 0
        db_status = "connected"
    except Exception as e:
        db_status = f"offline: {str(e)}"

    is_healthy = db_status == "connected" and faiss_info.get("loaded", False)

    return {
        "status": "ok" if is_healthy else "degraded",
        "service": "cinesense-backend",
        "database": {
            "status": db_status,
            "movie_count": movie_count,
        },
        "faiss": faiss_info,
        "mode": "hybrid_db" if db_status == "connected" else "tmdb_direct_fallback",
    }


add_middleware(app)

app.include_router(auth_router)
app.include_router(recommend_router)
app.include_router(movies_router)
app.include_router(watchlist_router)
