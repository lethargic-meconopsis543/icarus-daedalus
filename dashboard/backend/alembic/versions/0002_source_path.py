"""add source_path to memory_entries

Revision ID: 0002_source_path
Revises: 0001_init
"""
from alembic import op
import sqlalchemy as sa

revision = "0002_source_path"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("memory_entries") as batch:
        batch.add_column(sa.Column("source_path", sa.String, nullable=True))
    op.create_index("ix_memory_entries_source_path", "memory_entries", ["source_path"], unique=True)


def downgrade():
    op.drop_index("ix_memory_entries_source_path", table_name="memory_entries")
    with op.batch_alter_table("memory_entries") as batch:
        batch.drop_column("source_path")
