import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models.user import User
from app.models.movie import Movie
from app.models.watchlist import Watchlist
from app.schemas.watchlist import (
    WatchlistAddRequest, WatchlistAddResponse, WatchlistResponse, WatchlistItemOut
)
from app.schemas.movie import MovieOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/watchlist", tags=["Watchlist"])


@router.post("", response_model=WatchlistAddResponse, status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    payload: WatchlistAddRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify movie exists
    movie_result = await db.execute(select(Movie).where(Movie.id == payload.movie_id))
    if not movie_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Movie not found")

    item = Watchlist(user_id=current_user.id, movie_id=payload.movie_id)
    db.add(item)
    try:
        await db.flush()
        await db.refresh(item)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Movie already in watchlist")

    return WatchlistAddResponse(id=item.id, movie_id=item.movie_id, added_at=item.added_at)


@router.get("", response_model=WatchlistResponse)
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Watchlist).where(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.added_at.desc())
    )
    items = result.scalars().all()

    # Fetch movies
    movie_ids = [item.movie_id for item in items]
    if movie_ids:
        movie_result = await db.execute(select(Movie).where(Movie.id.in_(movie_ids)))
        movies = {m.id: m for m in movie_result.scalars().all()}
    else:
        movies = {}

    out_items = [
        WatchlistItemOut(
            id=item.id,
            movie=MovieOut.model_validate(movies[item.movie_id]),
            added_at=item.added_at,
        )
        for item in items
        if item.movie_id in movies
    ]

    return WatchlistResponse(total=len(out_items), items=out_items)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Watchlist).where(
            Watchlist.id == item_id,
            Watchlist.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    await db.delete(item)
