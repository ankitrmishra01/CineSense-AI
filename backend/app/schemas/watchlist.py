import uuid
from datetime import datetime
from pydantic import BaseModel
from app.schemas.movie import MovieOut


class WatchlistAddRequest(BaseModel):
    movie_id: int


class WatchlistItemOut(BaseModel):
    id: uuid.UUID
    movie: MovieOut
    added_at: datetime

    class Config:
        from_attributes = True


class WatchlistAddResponse(BaseModel):
    id: uuid.UUID
    movie_id: int
    added_at: datetime

    class Config:
        from_attributes = True


class WatchlistResponse(BaseModel):
    total: int
    items: list[WatchlistItemOut]
