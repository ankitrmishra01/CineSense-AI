from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.movie import Movie
from app.schemas.movie import MovieOut, MovieSearchResult
from app.services.tmdb_service import get_trending_movies_async, get_now_playing_movies_async

router = APIRouter(prefix="/movies", tags=["Movies"])

from app.services.tmdb_service import _tmdb_get_async, build_poster_url

def _map_tmdb_to_movieout(tmdb_movie: dict) -> MovieOut:
    return MovieOut(
        id=tmdb_movie.get("id"),
        title=tmdb_movie.get("title", tmdb_movie.get("name", "Unknown")),
        overview=tmdb_movie.get("overview"),
        tagline=tmdb_movie.get("tagline"),
        genres=[{"id": g_id, "name": "Genre"} for g_id in tmdb_movie.get("genre_ids", [])],
        poster_path=build_poster_url(tmdb_movie.get("poster_path")),
        backdrop_path=build_poster_url(tmdb_movie.get("backdrop_path"), "w1280"),
        vote_average=tmdb_movie.get("vote_average"),
        runtime=tmdb_movie.get("runtime"),
        release_date=tmdb_movie.get("release_date") or None,
    )

@router.get("/live/trending", response_model=list[MovieOut])
async def get_live_trending():
    results = await get_trending_movies_async()
    return [_map_tmdb_to_movieout(m) for m in results]

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
    result = await db.execute(
        select(Movie)
        .where(Movie.title.ilike(f"%{q}%"))
        .order_by(Movie.vote_average.desc().nulls_last())
        .limit(limit)
    )
    movies = result.scalars().all()
    return MovieSearchResult(results=[MovieOut.model_validate(m) for m in movies], total=len(movies))


@router.get("/{movie_id}", response_model=MovieOut)
async def get_movie(movie_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Movie).where(Movie.id == movie_id))
    movie = result.scalar_one_or_none()
    if movie:
        return MovieOut.model_validate(movie)
        
    # Fallback to TMDB directly
    from app.services.tmdb_service import _tmdb_get_async, build_poster_url
    tmdb_movie = await _tmdb_get_async(f"/movie/{movie_id}")
    if not tmdb_movie:
        raise HTTPException(status_code=404, detail="Movie not found in DB or TMDB")
    
    # Map raw TMDB to MovieOut structure roughly
    return MovieOut(
        id=tmdb_movie.get("id"),
        title=tmdb_movie.get("title", "Unknown"),
        overview=tmdb_movie.get("overview"),
        tagline=tmdb_movie.get("tagline"),
        genres=[{"id": g["id"], "name": g["name"]} for g in tmdb_movie.get("genres", [])],
        poster_path=build_poster_url(tmdb_movie.get("poster_path")),
        backdrop_path=build_poster_url(tmdb_movie.get("backdrop_path"), "w1280"),
        vote_average=tmdb_movie.get("vote_average"),
        runtime=tmdb_movie.get("runtime"),
        release_date=tmdb_movie.get("release_date") or None,
    )
