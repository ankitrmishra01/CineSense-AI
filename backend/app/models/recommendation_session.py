import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import Text, DateTime, ForeignKey, func, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from app.database import Base

JSONBType = JSON().with_variant(PG_JSONB(), "postgresql")


class RecommendationSession(Base):
    __tablename__ = "recommendation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    mood_text: Mapped[Optional[str]] = mapped_column(Text)
    emotion_tags: Mapped[Optional[dict]] = mapped_column(JSONBType)
    filters: Mapped[Optional[dict]] = mapped_column(JSONBType)
    result_movie_ids: Mapped[Optional[dict]] = mapped_column(JSONBType)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
