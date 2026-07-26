"""add belongs_to_collection

Revision ID: e23c4d5f6g7h
Revises: cdec091d82f5
Create Date: 2026-07-26 16:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e23c4d5f6g7h'
down_revision: Union[str, None] = 'cdec091d82f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('movies', sa.Column('belongs_to_collection', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('movies', 'belongs_to_collection')
