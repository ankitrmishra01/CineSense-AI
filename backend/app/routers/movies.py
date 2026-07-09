from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.movie import Movie
from app.schemas.movie import MovieOut, MovieSearchResult

router = APIRouter(prefix="/movies", tags=["Movies"])


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
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return MovieOut.model_validate(movie)
