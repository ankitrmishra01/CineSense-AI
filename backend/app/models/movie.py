from datetime import date, datetime
from typing import Optional
from sqlalchemy import Integer, String, Numeric, Date, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # TMDB movie ID
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    overview: Mapped[Optional[str]] = mapped_column(Text)
    tagline: Mapped[Optional[str]] = mapped_column(String(500))
    genres: Mapped[Optional[dict]] = mapped_column(JSONB)         # [{"id": 18, "name": "Drama"}]
    keywords: Mapped[Optional[dict]] = mapped_column(JSONB)       # ["redemption", ...]
    poster_path: Mapped[Optional[str]] = mapped_column(String(255))
    backdrop_path: Mapped[Optional[str]] = mapped_column(String(255))
    runtime: Mapped[Optional[int]] = mapped_column(Integer)
    vote_average: Mapped[Optional[float]] = mapped_column(Numeric(4, 2))
    vote_count: Mapped[Optional[int]] = mapped_column(Integer)
    release_date: Mapped[Optional[date]] = mapped_column(Date)
    trailer_key: Mapped[Optional[str]] = mapped_column(String(100))
    watch_providers: Mapped[Optional[dict]] = mapped_column(JSONB)  # {"US": {...}}
    embedding_id: Mapped[Optional[int]] = mapped_column(Integer)    # FAISS index position
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
