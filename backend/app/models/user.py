from typing import Optional
import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, func, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from app.database import Base

JSONBType = JSON().with_variant(PG_JSONB(), "postgresql")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    preferred_languages: Mapped[Optional[dict]] = mapped_column(JSONBType, default=list)
    preferred_audio_mode: Mapped[Optional[str]] = mapped_column(String(50), default="original")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
