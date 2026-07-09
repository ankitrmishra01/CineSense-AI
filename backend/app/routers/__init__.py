from app.routers.auth import router as auth_router
from app.routers.recommend import router as recommend_router
from app.routers.movies import router as movies_router
from app.routers.watchlist import router as watchlist_router

__all__ = ["auth_router", "recommend_router", "movies_router", "watchlist_router"]
