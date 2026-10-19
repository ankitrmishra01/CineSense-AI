from typing import Optional, Any
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_DEFAULT_FASTEMBED_CACHE = str((_BACKEND_DIR / ".cache" / "fastembed").resolve())


class Settings(BaseSettings):
    # Database (defaults to local SQLite; overridden by DATABASE_URL env var in production)
    DATABASE_URL: str = "sqlite+aiosqlite:///cinesense_local.db"
    SYNC_DATABASE_URL: Optional[str] = "sqlite:///cinesense_local.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_async_db_url(cls, v: Optional[str]) -> str:
        if not v:
            return "sqlite+aiosqlite:///cinesense_dev.db"
        url = v.strip()
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql://") and not url.startswith("postgresql+"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    @field_validator("SYNC_DATABASE_URL", mode="before")
    @classmethod
    def assemble_sync_db_url(cls, v: Optional[str], info) -> str:
        if v and v.strip() and "localhost" not in v:
            url = v.strip()
            if url.startswith("postgres://"):
                return url.replace("postgres://", "postgresql+psycopg2://", 1)
            if url.startswith("postgresql://") and not url.startswith("postgresql+"):
                return url.replace("postgresql://", "postgresql+psycopg2://", 1)
            return url
        # Derive from DATABASE_URL if available
        data = info.data
        async_url = data.get("DATABASE_URL")
        if async_url:
            if "sqlite" in async_url:
                return async_url.replace("+aiosqlite", "")
            return async_url.replace("+asyncpg", "+psycopg2")
        return v or "postgresql+psycopg2://postgres:password@localhost:5432/cinesense"

    # JWT
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # TMDB
    TMDB_API_KEY: str = ""
    TMDB_BASE_URL: str = "https://api.themoviedb.org/3"
    TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p"

    # Groq
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"  # active, low-latency (<200ms) for query translation and explanations

    # FAISS
    FAISS_INDEX_PATH: str = "faiss_index/movies.index"
    FAISS_ID_MAP_PATH: str = "faiss_index/id_map.json"

    # Embedding Cache & Settings
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIM: int = 384
    FASTEMBED_CACHE_PATH: Optional[str] = _DEFAULT_FASTEMBED_CACHE

    # App
    APP_NAME: str = "CineSense AI"
    DEBUG: bool = False
    CORS_ORIGINS: list[str] = [
        "https://cine-sense-ai.vercel.app",
        "https://cinesense-ai.vercel.app",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        elif isinstance(v, list):
            return v
        return [
            "https://cine-sense-ai.vercel.app",
            "https://cinesense-ai.vercel.app",
            "http://localhost:5173",
            "http://localhost:4173",
            "http://localhost:3000",
        ]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
