from app.schemas.auth import (
    SignupRequest, LoginRequest, RefreshRequest, LogoutRequest,
    UserOut, AuthResponse, TokenRefreshResponse
)
from app.schemas.movie import MovieOut, MovieSearchResult
from app.schemas.recommend import RecommendRequest, RecommendResponse, RecommendationItem
from app.schemas.watchlist import WatchlistAddRequest, WatchlistItemOut, WatchlistAddResponse, WatchlistResponse

__all__ = [
    "SignupRequest", "LoginRequest", "RefreshRequest", "LogoutRequest",
    "UserOut", "AuthResponse", "TokenRefreshResponse",
    "MovieOut", "MovieSearchResult",
    "RecommendRequest", "RecommendResponse", "RecommendationItem",
    "WatchlistAddRequest", "WatchlistItemOut", "WatchlistAddResponse", "WatchlistResponse",
]
