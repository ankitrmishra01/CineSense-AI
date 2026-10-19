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
    trailer_name: Optional[str] = None
    watch_providers: Optional[dict] = None
    cast_crew: Optional[dict] = None
    belongs_to_collection: Optional[dict] = None
    original_language: Optional[str] = None
    origin_country: Optional[list[str]] = None
    spoken_languages: Optional[list[Any]] = None
    original_title: Optional[str] = None
    popularity: Optional[float] = None
    cohort_quality_score: Optional[float] = None

    class Config:
        from_attributes = True


class MovieSearchResult(BaseModel):
    results: list[MovieOut]
    total: int
