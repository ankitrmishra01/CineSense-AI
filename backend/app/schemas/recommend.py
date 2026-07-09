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
    top_k: int = 30

    @model_validator(mode="after")
    def at_least_one_mood_input(self) -> "RecommendRequest":
        if not self.mood_text and not self.emotion_tags:
            raise ValueError("At least one of mood_text or emotion_tags must be provided")
        if self.top_k < 1 or self.top_k > 50:
            raise ValueError("top_k must be between 1 and 50")
        return self


class RecommendationItem(BaseModel):
    movie: MovieOut
    similarity_score: float
    explanation: str


class RecommendResponse(BaseModel):
    session_id: Optional[uuid.UUID] = None
    query_summary: str
    recommendations: list[RecommendationItem]
