from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings
from app.middleware import add_middleware
from app.routers import auth_router, recommend_router, movies_router, watchlist_router
from app.services import faiss_preload


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up FAISS index + embedding model
    # faiss_preload() # Disabled for Render Free Tier to prevent Out Of Memory during boot
    yield
    # Shutdown: nothing to clean up


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
    from sqlalchemy import text

    faiss_info = get_faiss_stats()

    db_status = "unknown"
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "service": "cinesense-backend",
        "database": db_status,
        "faiss": faiss_info,
    }



add_middleware(app)

app.include_router(auth_router)
app.include_router(recommend_router)
app.include_router(movies_router)
app.include_router(watchlist_router)

