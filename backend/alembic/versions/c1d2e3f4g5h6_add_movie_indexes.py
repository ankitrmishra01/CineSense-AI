"""add movie performance indexes
Revision ID: c1d2e3f4g5h6
Revises: ab1bd420263b
Create Date: 2026-10-17 15:26:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, None] = 'ab1bd420263b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pg_trgm extension exists for trigram index on title
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # B-tree indexes for fast sorting and filtering
    op.create_index('idx_movies_release_date', 'movies', ['release_date'], unique=False)
    op.create_index('idx_movies_vote_average', 'movies', ['vote_average'], unique=False)
    op.create_index('idx_movies_embedding_id', 'movies', ['embedding_id'], unique=False)

    # GIN Trigram index on title for fast case-insensitive fuzzy lookup
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_movies_title_trgm ON movies USING gin (title gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_movies_title_trgm")
    op.drop_index('idx_movies_embedding_id', table_name='movies')
    op.drop_index('idx_movies_vote_average', table_name='movies')
    op.drop_index('idx_movies_release_date', table_name='movies')
