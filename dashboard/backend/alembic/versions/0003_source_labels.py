"""add source labels to events, memory_entries, and recalls

Revision ID: 0003_source_labels
Revises: 0002_source_path
"""
from alembic import op
import sqlalchemy as sa

revision = "0003_source_labels"
down_revision = "0002_source_path"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("events") as batch:
        batch.add_column(sa.Column("source", sa.String(), nullable=False, server_default="unknown"))
    op.create_index("ix_events_source", "events", ["source"], unique=False)

    with op.batch_alter_table("memory_entries") as batch:
        batch.add_column(sa.Column("source", sa.String(), nullable=False, server_default="unknown"))
    op.create_index("ix_memory_entries_source", "memory_entries", ["source"], unique=False)

    with op.batch_alter_table("recalls") as batch:
        batch.add_column(sa.Column("source", sa.String(), nullable=False, server_default="unknown"))
    op.create_index("ix_recalls_source", "recalls", ["source"], unique=False)


def downgrade():
    op.drop_index("ix_recalls_source", table_name="recalls")
    with op.batch_alter_table("recalls") as batch:
        batch.drop_column("source")

    op.drop_index("ix_memory_entries_source", table_name="memory_entries")
    with op.batch_alter_table("memory_entries") as batch:
        batch.drop_column("source")

    op.drop_index("ix_events_source", table_name="events")
    with op.batch_alter_table("events") as batch:
        batch.drop_column("source")
