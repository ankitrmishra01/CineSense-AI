from datetime import date, datetime
from typing import Optional
from sqlalchemy import Integer, String, Numeric, Date, DateTime, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from app.database import Base

# Cross-database JSON type: Native JSONB in Postgres, standard JSON in SQLite
JSONBType = JSON().with_variant(PG_JSONB(), "postgresql")


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # TMDB movie ID
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    overview: Mapped[Optional[str]] = mapped_column(Text)
    tagline: Mapped[Optional[str]] = mapped_column(String(500))
    genres: Mapped[Optional[dict]] = mapped_column(JSONBType)         # [{"id": 18, "name": "Drama"}]
    keywords: Mapped[Optional[dict]] = mapped_column(JSONBType)       # ["redemption", ...]
    poster_path: Mapped[Optional[str]] = mapped_column(String(255))
    backdrop_path: Mapped[Optional[str]] = mapped_column(String(255))
    runtime: Mapped[Optional[int]] = mapped_column(Integer)
    vote_average: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    vote_count: Mapped[Optional[int]] = mapped_column(Integer)
    release_date: Mapped[Optional[date]] = mapped_column(Date)
    trailer_key: Mapped[Optional[str]] = mapped_column(String(100))
    watch_providers: Mapped[Optional[dict]] = mapped_column(JSONBType)  # {"US": {...}}
    belongs_to_collection: Mapped[Optional[dict]] = mapped_column(JSONBType) # {"id": 123, "name": "..."}
    cast_crew: Mapped[Optional[dict]] = mapped_column(JSONBType) # {"cast": [...], "crew": [...]}
    original_language: Mapped[Optional[str]] = mapped_column(String(10), index=True)
    origin_country: Mapped[Optional[dict]] = mapped_column(JSONBType)
    spoken_languages: Mapped[Optional[dict]] = mapped_column(JSONBType)
    original_title: Mapped[Optional[str]] = mapped_column(String(500))
    popularity: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), index=True)
    cohort_quality_score: Mapped[Optional[float]] = mapped_column(Numeric(5, 3), index=True)
    embedding_id: Mapped[Optional[int]] = mapped_column(Integer)    # FAISS index position
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
