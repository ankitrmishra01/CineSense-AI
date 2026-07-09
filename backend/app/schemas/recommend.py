import uuid
from typing import Optional
from pydantic import BaseModel, model_validator
from app.schemas.movie import MovieOut


class RecommendFilters(BaseModel):
    genre_ids: Optional[list[int]] = None
    min_rating: Optional[float] = None
    max_runtime: Optional[int] = None
    min_year: Optional[int] = None


class RecommendRequest(BaseModel):
    mood_text: Optional[str] = None
    emotion_tags: Optional[list[str]] = None
    filters: Optional[RecommendFilters] = None
    page: int = 1
    limit: int = 20
    seed: Optional[int] = None

    @model_validator(mode="after")
    def at_least_one_mood_input(self) -> "RecommendRequest":
        if not self.mood_text and not self.emotion_tags:
            raise ValueError("At least one of mood_text or emotion_tags must be provided")
        if self.page < 1:
            raise ValueError("page must be at least 1")
        if self.limit < 1 or self.limit > 100:
            raise ValueError("limit must be between 1 and 100")
        return self


class RecommendationItem(BaseModel):
    movie: MovieOut
    similarity_score: float
    explanation: str


class RecommendResponse(BaseModel):
    session_id: Optional[uuid.UUID] = None
    query_summary: str
    total_results: int
    total_pages: int
    current_page: int
    recommendations: list[RecommendationItem]
