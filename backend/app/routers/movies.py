from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.movie import Movie
from app.schemas.movie import MovieOut, MovieSearchResult
from app.services.tmdb_service import (
    get_trending_movies_async,
    get_now_playing_movies_async,
    get_similar_movies_async,
)

router = APIRouter(prefix="/movies", tags=["Movies"])

from app.services.tmdb_service import _tmdb_get_async, build_poster_url

def _map_tmdb_to_movieout(tmdb_movie: dict) -> MovieOut:
    return MovieOut(
        id=tmdb_movie.get("id"),
        title=tmdb_movie.get("title", tmdb_movie.get("name", "Unknown")),
        original_title=tmdb_movie.get("original_title"),
        original_language=tmdb_movie.get("original_language"),
        popularity=float(tmdb_movie.get("popularity", 0.0) or 0.0),
        overview=tmdb_movie.get("overview"),
        tagline=tmdb_movie.get("tagline"),
        genres=[{"id": g_id, "name": "Genre"} for g_id in tmdb_movie.get("genre_ids", [])],
        poster_path=build_poster_url(tmdb_movie.get("poster_path")),
        backdrop_path=build_poster_url(tmdb_movie.get("backdrop_path"), "w1280"),
        vote_average=tmdb_movie.get("vote_average"),
        vote_count=tmdb_movie.get("vote_count"),
        runtime=tmdb_movie.get("runtime"),
        release_date=tmdb_movie.get("release_date") or None,
    )

@router.get("/live/trending", response_model=list[MovieOut])
async def get_live_trending():
    results = await get_trending_movies_async()
    return [_map_tmdb_to_movieout(m) for m in results]

@router.get("/live/trending-india", response_model=list[MovieOut])
async def get_live_trending_india():
    from app.services.tmdb_service import get_trending_india_async
    results = await get_trending_india_async()
    return [_map_tmdb_to_movieout(m) for m in results if m.get("poster_path")][:20]

@router.get("/live/trending-by-language", response_model=list[MovieOut])
async def get_live_trending_by_language(language: str = Query("hi", description="ISO 639-1 language code")):
    from app.services.tmdb_service import get_trending_by_language_async
    results = await get_trending_by_language_async(language)
    return [_map_tmdb_to_movieout(m) for m in results if m.get("poster_path")][:20]

@router.get("/live/top-rated-by-language", response_model=list[MovieOut])
async def get_top_rated_by_language(
    language: str = Query("hi", description="ISO 639-1 language code"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve top-rated movies for a language cohort using stored Bayesian cohort quality scores."""
    result = await db.execute(
        select(Movie)
        .where(Movie.original_language == language.strip().lower())
        .order_by(Movie.cohort_quality_score.desc().nullslast())
        .limit(limit)
    )
    movies = result.scalars().all()
    return [MovieOut.model_validate(m) for m in movies]

@router.get("/live/now-playing", response_model=list[MovieOut])
async def get_live_now_playing():
    results = await get_now_playing_movies_async()
    return [_map_tmdb_to_movieout(m) for m in results]


@router.get("/search", response_model=MovieSearchResult)
async def search_movies(
    q: str = Query(..., min_length=1, description="Title search query"),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    from app.services.tmdb_service import _tmdb_get_async
    
    data = await _tmdb_get_async("/search/movie", {"query": q, "include_adult": "false"})
    results = data.get("results", []) if data else []
    
    movies_out = []
    for m in results:
        # Only return movies with posters to keep UI clean
        if not m.get("poster_path"):
            continue
        movies_out.append(_map_tmdb_to_movieout(m))
        if len(movies_out) >= limit:
            break
            
    return MovieSearchResult(results=movies_out, total=len(movies_out))


@router.get("/{movie_id}", response_model=MovieOut)
async def get_movie(
    movie_id: int,
    preferred_language: Optional[str] = Query(None, description="Preferred language code for trailers"),
    db: AsyncSession = Depends(get_db)
):
    from app.services.tmdb_service import get_live_movie_details_async

    # 1. Fetch base record from local/primary DB
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()

    # 2. Fetch live TMDB details (2s timeout, 4h cache, request deduplication)
    live_details = await get_live_movie_details_async(movie_id, preferred_language)

    if movie:
        movie_out = MovieOut.model_validate(movie)
        if live_details:
            if live_details.get("trailer_key"):
                movie_out.trailer_key = live_details["trailer_key"]
            if live_details.get("trailer_name"):
                movie_out.trailer_name = live_details["trailer_name"]
            if live_details.get("watch_providers"):
                movie_out.watch_providers = live_details["watch_providers"]
            if live_details.get("cast_crew"):
                movie_out.cast_crew = live_details["cast_crew"]
        return movie_out

    # If not in DB, use live details if available
    if live_details:
        genres = []
        for g in live_details.get("genres", []):
            if isinstance(g, dict) and "id" in g:
                genres.append({"id": g["id"], "name": g.get("name", "Genre")})

        return MovieOut(
            id=live_details["id"],
            title=live_details.get("title") or "Unknown",
            original_title=live_details.get("original_title"),
            original_language=live_details.get("original_language"),
            popularity=live_details.get("popularity", 0.0),
            overview=live_details.get("overview"),
            tagline=live_details.get("tagline"),
            genres=genres,
            poster_path=live_details.get("poster_path"),
            backdrop_path=live_details.get("backdrop_path"),
            vote_average=live_details.get("vote_average"),
            vote_count=live_details.get("vote_count"),
            runtime=live_details.get("runtime"),
            release_date=live_details.get("release_date") or None,
            trailer_key=live_details.get("trailer_key"),
            trailer_name=live_details.get("trailer_name"),
            watch_providers=live_details.get("watch_providers"),
            cast_crew=live_details.get("cast_crew"),
        )

    raise HTTPException(status_code=404, detail="Movie not found in DB or TMDB")


@router.get("/{movie_id}/similar", response_model=list[MovieOut])
async def get_similar_movies(movie_id: int):
    results = await get_similar_movies_async(movie_id)
    return [_map_tmdb_to_movieout(m) for m in results if m.get("poster_path")][:10]

