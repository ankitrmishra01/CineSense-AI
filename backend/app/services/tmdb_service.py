"""TMDB API helpers used by scripts and the movie detail endpoint."""
import logging
from typing import Optional
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


def _tmdb_get(path: str, params: dict = None) -> Optional[dict]:
    """Synchronous TMDB GET helper (used by pipeline scripts)."""
    url = f"{settings.TMDB_BASE_URL}{path}"
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    try:
        resp = httpx.get(url, params=p, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("TMDB request failed %s: %s", path, e)
        return None


async def _tmdb_get_async(path: str, params: dict = None) -> Optional[dict]:
    """Async TMDB GET helper used by FastAPI routes."""
    url = f"{settings.TMDB_BASE_URL}{path}"
    p = {"api_key": settings.TMDB_API_KEY, **(params or {})}
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(url, params=p)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.warning("TMDB async request failed %s: %s", path, e)
            return None


def get_movie_details_sync(movie_id: int) -> Optional[dict]:
    return _tmdb_get(f"/movie/{movie_id}", {"append_to_response": "keywords,videos"})


def get_watch_providers_sync(movie_id: int) -> Optional[dict]:
    data = _tmdb_get(f"/movie/{movie_id}/watch/providers")
    return data.get("results") if data else None


def extract_trailer_key(videos_data: Optional[dict]) -> Optional[str]:
    if not videos_data:
        return None
    videos = videos_data.get("results", [])
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer" and v.get("official"):
            return v["key"]
    for v in videos:
        if v.get("site") == "YouTube" and v.get("type") == "Trailer":
            return v["key"]
    return None


def extract_keywords(keywords_data: Optional[dict]) -> list[str]:
    if not keywords_data:
        return []
    return [kw["name"] for kw in keywords_data.get("keywords", [])][:30]


def build_poster_url(poster_path: Optional[str], size: str = "w500") -> Optional[str]:
    if not poster_path:
        return None
    return f"{settings.TMDB_IMAGE_BASE_URL}/{size}{poster_path}"
