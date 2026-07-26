"""add trigram index to cast_crew

Revision ID: ab1bd420263b
Revises: b253738aa863
Create Date: 2026-07-26 17:01:19.873646

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab1bd420263b'
down_revision: Union[str, None] = 'b253738aa863'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Ensure pg_trgm extension exists
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    
    # Create GIN index on cast_crew cast to text for fast ILIKE
    op.execute(
        "CREATE INDEX idx_movies_cast_crew_trgm ON movies USING gin ((cast_crew::text) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_movies_cast_crew_trgm")
