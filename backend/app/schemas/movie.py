from datetime import date
from typing import Optional, Any
from pydantic import BaseModel


class GenreSchema(BaseModel):
    id: int
    name: str


class WatchProviderEntry(BaseModel):
    provider_name: str
    logo_path: Optional[str] = None


class WatchProvidersRegion(BaseModel):
    flatrate: Optional[list[WatchProviderEntry]] = []
    rent: Optional[list[WatchProviderEntry]] = []
    buy: Optional[list[WatchProviderEntry]] = []


class MovieOut(BaseModel):
    id: int
    title: str
    overview: Optional[str] = None
    tagline: Optional[str] = None
    genres: Optional[list[Any]] = None
    keywords: Optional[list[str]] = None
    poster_path: Optional[str] = None
    backdrop_path: Optional[str] = None
    runtime: Optional[int] = None
    vote_average: Optional[float] = None
    vote_count: Optional[int] = None
    release_date: Optional[date] = None
    trailer_key: Optional[str] = None
    watch_providers: Optional[dict] = None

    class Config:
        from_attributes = True


class MovieSearchResult(BaseModel):
    results: list[MovieOut]
    total: int
