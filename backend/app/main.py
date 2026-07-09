from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.config import settings
from app.middleware import add_middleware
from app.routers import auth_router, recommend_router, movies_router, watchlist_router
from app.services import faiss_preload


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: warm up FAISS index + embedding model
    faiss_preload()
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title=settings.APP_NAME,
    description="Emotion-aware movie discovery platform",
    version="1.0.0",
    lifespan=lifespan,
)

add_middleware(app)

app.include_router(auth_router)
app.include_router(recommend_router)
app.include_router(movies_router)
app.include_router(watchlist_router)


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}
