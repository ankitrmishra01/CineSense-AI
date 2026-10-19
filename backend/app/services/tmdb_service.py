"""TMDB API helpers used by scripts and the movie detail endpoint."""
import asyncio
import logging
import re
from typing import Optional, Tuple, Dict, Any, List
import httpx
from cachetools import TTLCache
from app.config import settings

logger = logging.getLogger(__name__)

# Cache for general lists (trending, now playing, similar) - 15 min TTL
_live_cache = TTLCache(maxsize=100, ttl=900)

# Dedicated in-memory cache for movie details (videos, providers, credits) - 4 hours TTL
_movie_details_cache = TTLCache(maxsize=500, ttl=14400)

# Request de-duplication dictionary for concurrent in-flight movie detail requests
_details_inflight: dict[int, asyncio.Future] = {}


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


DISQUALIFIED_TRAILER_PATTERNS = re.compile(
    r"\b(song|video\s+song|audio|track|jukebox|lyric|lyrical|bloopers?|interview|scene|dialogue|making\s+of|behind\s+the\s+scenes|special\s+clip|promo\s+song|full\s+video|hook\s+step|dance)\b",
    re.IGNORECASE
)


def extract_best_trailer(
    videos_data: Optional[dict],
    preferred_language: Optional[str] = None
) -> Tuple[Optional[str], Optional[str]]:
    """
    Select the best official trailer:
    - STRICTLY excludes movie songs, audio tracks, bloopers, making-of clips, and interviews.
    - Only accepts videos of type 'Trailer' or 'Teaser'.
    - Prioritizes official trailers matching preferred language, then official English trailers.
    Returns (trailer_key, trailer_title) or (None, None) if no verified trailer exists.
    """
    if not videos_data:
        return None, None
    results = videos_data.get("results", [])
    if not isinstance(results, list) or not results:
        return None, None

    # Filter strictly to YouTube trailers/teasers that are NOT songs, clips, or promotional extras
    valid_trailers = []
    for v in results:
        if v.get("site") != "YouTube" or not v.get("key"):
            continue
        v_type = v.get("type", "")
        v_name = v.get("name", "")
        
        # Strictly reject non-trailers
        if v_type not in ("Trailer", "Teaser"):
            continue
        # Strictly reject songs, jukeboxes, making-of clips masquerading as trailers
        if DISQUALIFIED_TRAILER_PATTERNS.search(v_name) or DISQUALIFIED_TRAILER_PATTERNS.search(v_type):
            continue
        valid_trailers.append(v)

    if not valid_trailers:
        return None, None

    pref_lang = (preferred_language or "").strip().lower()

    def score_video(v: dict) -> int:
        v_type = v.get("type", "")
        is_official = bool(v.get("official"))
        v_lang = (v.get("iso_639_1") or "").lower()
        v_name = (v.get("name") or "").lower()

        score = 0
        if v_type == "Trailer":
            score += 100
        elif v_type == "Teaser":
            score += 40

        if "official trailer" in v_name:
            score += 50
        elif "trailer" in v_name:
            score += 25

        if is_official:
            score += 50

        if pref_lang and v_lang == pref_lang:
            score += 40
        elif v_lang == "en":
            score += 20

        return score

    best_video = max(valid_trailers, key=score_video, default=None)
    if best_video:
        return best_video["key"], best_video.get("name", "Official Trailer")
    return None, None


def extract_trailer_key(videos_data: Optional[dict]) -> Optional[str]:
    key, _ = extract_best_trailer(videos_data)
    return key


REGION_NAMES = {
    "IN": "India",
    "US": "United States",
    "GB": "United Kingdom",
    "CA": "Canada",
    "AU": "Australia",
}


def extract_watch_providers(providers_data: Optional[dict]) -> dict:
    """
    Watch providers: use region IN first, then fall back to nearest available region (US, then first available).
    Group by Stream (flatrate), Rent, and Buy with provider logos and names.
    Includes TMDB watch link and JustWatch attribution.
    """
    if not providers_data:
        return {
            "region_code": "IN",
            "region_label": "India",
            "link": None,
            "attribution": "Streaming data by JustWatch",
            "stream": [],
            "rent": [],
            "buy": [],
            "has_providers": False,
        }

    raw_results = providers_data.get("results", {}) if isinstance(providers_data, dict) else {}

    # Find the best region
    chosen_region = None
    STREAM_KEYS = ("flatrate", "free", "ads", "rent", "buy")
    if "IN" in raw_results and any(raw_results["IN"].get(k) for k in STREAM_KEYS):
        chosen_region = "IN"
    elif "US" in raw_results and any(raw_results["US"].get(k) for k in STREAM_KEYS):
        chosen_region = "US"
    else:
        for r_code, r_data in raw_results.items():
            if isinstance(r_data, dict) and any(r_data.get(k) for k in STREAM_KEYS):
                chosen_region = r_code
                break

    if not chosen_region:
        chosen_region = "IN"

    region_data = raw_results.get(chosen_region, {})
    region_label = REGION_NAMES.get(chosen_region, chosen_region)

    def format_provider_list(items: Optional[list]) -> list[dict]:
        if not items or not isinstance(items, list):
            return []
        formatted = []
        for p in items:
            if not isinstance(p, dict):
                continue
            formatted.append({
                "provider_id": p.get("provider_id"),
                "provider_name": p.get("provider_name", "Unknown"),
                "logo_path": p.get("logo_path"),
                "display_priority": p.get("display_priority", 999),
            })
        return formatted

    flatrate = format_provider_list(region_data.get("flatrate"))
    free = format_provider_list(region_data.get("free"))
    ads = format_provider_list(region_data.get("ads"))
    seen_ids = set()
    stream = []
    for p in flatrate + free + ads:
        pid = p.get("provider_id")
        if pid not in seen_ids:
            seen_ids.add(pid)
            stream.append(p)

    rent = format_provider_list(region_data.get("rent"))
    buy = format_provider_list(region_data.get("buy"))
    has_providers = bool(stream or rent or buy)

    output = {
        "region_code": chosen_region,
        "region_label": region_label,
        "link": region_data.get("link"),
        "attribution": "Streaming data by JustWatch",
        "stream": stream,
        "rent": rent,
        "buy": buy,
        "has_providers": has_providers,
    }

    # Retain raw region entries for backwards compatibility with providers[regionCode] access
    for k, v in raw_results.items():
        if k not in output:
            output[k] = v

    return output


def extract_cast_and_crew(credits_data: Optional[dict]) -> dict:
    """
    Extract top 10 cast members with photo, name, character, plus directors.
    """
    if not credits_data or not isinstance(credits_data, dict):
        return {"cast": [], "crew": [], "directors": []}

    raw_cast = credits_data.get("cast", []) if isinstance(credits_data.get("cast"), list) else []
    raw_crew = credits_data.get("crew", []) if isinstance(credits_data.get("crew"), list) else []

    top_cast = []
    for c in raw_cast[:10]:
        if not isinstance(c, dict):
            continue
        top_cast.append({
            "id": c.get("id"),
            "name": c.get("name", "Unknown"),
            "character": c.get("character"),
            "profile_path": c.get("profile_path"),
            "order": c.get("order", 0),
        })

    directors = [
        {
            "id": c.get("id"),
            "name": c.get("name", "Unknown"),
            "job": "Director",
            "profile_path": c.get("profile_path"),
        }
        for c in raw_crew
        if isinstance(c, dict) and c.get("job") == "Director"
    ]

    return {
        "cast": top_cast,
        "crew": directors,
        "directors": [d["name"] for d in directors],
    }


def extract_keywords(keywords_data: Optional[dict]) -> list[str]:
    if not keywords_data:
        return []
    return [kw["name"] for kw in keywords_data.get("keywords", [])][:30]


def build_poster_url(poster_path: Optional[str], size: str = "w500") -> Optional[str]:
    if not poster_path:
        return None
    return f"{settings.TMDB_IMAGE_BASE_URL}/{size}{poster_path}"


async def get_trending_movies_async() -> list[dict]:
    if "trending" in _live_cache:
        return _live_cache["trending"]
    data = await _tmdb_get_async("/trending/movie/day")
    results = data.get("results", []) if data else []
    _live_cache["trending"] = results
    return results

async def get_trending_india_async() -> list[dict]:
    """Fetch movies trending in India (Indian origin / regional popular) from TMDB."""
    cache_key = "trending_india"
    if cache_key in _live_cache:
        return _live_cache[cache_key]

    params = {
        "region": "IN",
        "with_origin_country": "IN",
        "sort_by": "popularity.desc",
        "vote_count.gte": 5,
        "include_adult": "false",
    }
    data = await _tmdb_get_async("/discover/movie", params)
    results = data.get("results", []) if data else []
    _live_cache[cache_key] = results
    return results

async def get_trending_by_language_async(language: str) -> list[dict]:
    """Fetch trending movies for a specific language cohort."""
    lang = (language or "hi").strip().lower()
    cache_key = f"trending_lang_{lang}"
    if cache_key in _live_cache:
        return _live_cache[cache_key]

    params = {
        "with_original_language": lang,
        "sort_by": "popularity.desc",
        "vote_count.gte": 5,
        "include_adult": "false",
    }
    data = await _tmdb_get_async("/discover/movie", params)
    results = data.get("results", []) if data else []
    _live_cache[cache_key] = results
    return results

async def get_now_playing_movies_async() -> list[dict]:
    if "now_playing" in _live_cache:
        return _live_cache["now_playing"]
    data = await _tmdb_get_async("/movie/now_playing", {"region": "IN"})
    results = data.get("results", []) if data else []
    _live_cache["now_playing"] = results
    return results


async def get_similar_movies_async(movie_id: int) -> list[dict]:
    cache_key = f"similar_{movie_id}"
    if cache_key in _live_cache:
        return _live_cache[cache_key]
    data = await _tmdb_get_async(f"/movie/{movie_id}/recommendations")
    if not data or not data.get("results"):
        data = await _tmdb_get_async(f"/movie/{movie_id}/similar")
    results = data.get("results", []) if data else []
    _live_cache[cache_key] = results
    return results


async def get_live_movie_details_async(
    movie_id: int,
    preferred_language: Optional[str] = None
) -> Optional[dict]:
    """
    Fetch live movie details from TMDB with append_to_response=videos,watch/providers,credits,similar.
    Enforces a strict 2.0s timeout, in-memory TTL caching (4h), and in-flight request de-duplication.
    Never blocks a request longer than 2.0s and never breaks the page on failure.
    """
    cache_key = f"movie_details_{movie_id}"
    if cache_key in _movie_details_cache:
        return _movie_details_cache[cache_key]

    # In-flight request de-duplication
    loop = asyncio.get_running_loop()
    if movie_id in _details_inflight:
        try:
            return await asyncio.wait_for(asyncio.shield(_details_inflight[movie_id]), timeout=2.2)
        except Exception:
            return None

    fut = loop.create_future()
    _details_inflight[movie_id] = fut

    try:
        url = f"{settings.TMDB_BASE_URL}/movie/{movie_id}"
        params = {
            "api_key": settings.TMDB_API_KEY,
            "append_to_response": "videos,watch/providers,credits,similar",
        }
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                data = resp.json()
                t_key, t_name = extract_best_trailer(data.get("videos"), preferred_language)
                providers = extract_watch_providers(data.get("watch/providers"))
                credits = extract_cast_and_crew(data.get("credits"))
                similar = [
                    m for m in data.get("similar", {}).get("results", [])
                    if isinstance(m, dict) and m.get("poster_path")
                ][:10]

                result = {
                    "id": data.get("id"),
                    "title": data.get("title") or data.get("name") or "Unknown",
                    "original_title": data.get("original_title"),
                    "original_language": data.get("original_language"),
                    "popularity": float(data.get("popularity", 0.0) or 0.0),
                    "overview": data.get("overview"),
                    "tagline": data.get("tagline"),
                    "runtime": data.get("runtime"),
                    "vote_average": data.get("vote_average"),
                    "vote_count": data.get("vote_count"),
                    "release_date": data.get("release_date"),
                    "poster_path": build_poster_url(data.get("poster_path")),
                    "backdrop_path": build_poster_url(data.get("backdrop_path"), "w1280"),
                    "genres": data.get("genres", []),
                    "trailer_key": t_key,
                    "trailer_name": t_name,
                    "watch_providers": providers,
                    "cast_crew": credits,
                    "similar": similar,
                    "raw": data,
                }
                _movie_details_cache[cache_key] = result
                if not fut.done():
                    fut.set_result(result)
                return result
            else:
                logger.warning("TMDB movie %d failed with status %d", movie_id, resp.status_code)
                if not fut.done():
                    fut.set_result(None)
                return None
    except Exception as e:
        logger.warning("TMDB movie details timeout or error for %d: %s", movie_id, e)
        if not fut.done():
            fut.set_result(None)
        return None
    finally:
        _details_inflight.pop(movie_id, None)


