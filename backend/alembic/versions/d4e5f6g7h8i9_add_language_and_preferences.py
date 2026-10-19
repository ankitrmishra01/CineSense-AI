"""add language cohort and user preference columns

Revision ID: d4e5f6g7h8i9
Revises: c1d2e3f4g5h6
Create Date: 2026-10-19 15:30:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6g7h8i9'
down_revision: Union[str, None] = 'c1d2e3f4g5h6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Cross-database JSON type: Native JSONB in Postgres, standard JSON in SQLite
JSONBType = sa.JSON().with_variant(JSONB(), "postgresql")


def upgrade() -> None:
    # ── 1. Movies Table Language & Cohort Enhancements ────────────────────────
    op.add_column('movies', sa.Column('original_language', sa.String(length=10), nullable=True))
    op.add_column('movies', sa.Column('origin_country', JSONBType, nullable=True))
    op.add_column('movies', sa.Column('spoken_languages', JSONBType, nullable=True))
    op.add_column('movies', sa.Column('original_title', sa.String(length=500), nullable=True))
    op.add_column('movies', sa.Column('popularity', sa.Numeric(precision=10, scale=3), nullable=True))
    op.add_column('movies', sa.Column('cohort_quality_score', sa.Numeric(precision=5, scale=3), nullable=True))

    # Fast filtering and sorting indexes
    op.create_index('idx_movies_original_language', 'movies', ['original_language'], unique=False)
    op.create_index('idx_movies_cohort_quality', 'movies', ['cohort_quality_score'], unique=False)
    op.create_index('idx_movies_popularity', 'movies', ['popularity'], unique=False)

    # ── 2. Users Table Language & Audio Preferences ───────────────────────────
    op.add_column('users', sa.Column('preferred_languages', JSONBType, nullable=True))
    op.add_column('users', sa.Column('preferred_audio_mode', sa.String(length=50), server_default='original', nullable=True))


def downgrade() -> None:
    # Users
    op.drop_column('users', 'preferred_audio_mode')
    op.drop_column('users', 'preferred_languages')

    # Movies
    op.drop_index('idx_movies_popularity', table_name='movies')
    op.drop_index('idx_movies_cohort_quality', table_name='movies')
    op.drop_index('idx_movies_original_language', table_name='movies')

    op.drop_column('movies', 'cohort_quality_score')
    op.drop_column('movies', 'popularity')
    op.drop_column('movies', 'original_title')
    op.drop_column('movies', 'spoken_languages')
    op.drop_column('movies', 'origin_country')
    op.drop_column('movies', 'original_language')
