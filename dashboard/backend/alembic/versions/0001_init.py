"""init schema

Revision ID: 0001_init
Revises:
"""
from alembic import op
import sqlalchemy as sa

revision = "0001_init"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "agents",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("platform", sa.String, server_default="hermes"),
        sa.Column("status", sa.String, server_default="offline"),
        sa.Column("current_task", sa.Text),
        sa.Column("last_seen_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_table(
        "projects",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("name", sa.String, nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("agent_id", sa.String, sa.ForeignKey("agents.id")),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id")),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("summary", sa.Text),
    )
    op.create_table(
        "events",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.String, sa.ForeignKey("agents.id")),
        sa.Column("session_id", sa.String, sa.ForeignKey("sessions.id")),
        sa.Column("kind", sa.String, nullable=False),
        sa.Column("payload", sa.JSON, server_default="{}"),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_index("ix_events_occurred_at", "events", ["occurred_at"])
    op.create_table(
        "memory_entries",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("author_agent_id", sa.String, sa.ForeignKey("agents.id")),
        sa.Column("session_id", sa.String, sa.ForeignKey("sessions.id")),
        sa.Column("project_id", sa.String, sa.ForeignKey("projects.id")),
        sa.Column("kind", sa.String, server_default="observation"),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, server_default=""),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("reuse_count", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_index("ix_memory_entries_created_at", "memory_entries", ["created_at"])
    op.create_table(
        "recalls",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("agent_id", sa.String, sa.ForeignKey("agents.id")),
        sa.Column("session_id", sa.String, sa.ForeignKey("sessions.id")),
        sa.Column("query", sa.Text, nullable=False),
        sa.Column("returned_entry_ids", sa.JSON, server_default="[]"),
        sa.Column("was_useful", sa.Boolean),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_index("ix_recalls_created_at", "recalls", ["created_at"])
    op.create_table(
        "provenance_edges",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("src_type", sa.String, nullable=False),
        sa.Column("src_id", sa.String, nullable=False),
        sa.Column("dst_type", sa.String, nullable=False),
        sa.Column("dst_id", sa.String, nullable=False),
        sa.Column("relation", sa.String, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_index("ix_prov_src", "provenance_edges", ["src_type", "src_id"])
    op.create_index("ix_prov_dst", "provenance_edges", ["dst_type", "dst_id"])
    op.create_table(
        "wiki_pages",
        sa.Column("id", sa.String, primary_key=True),
        sa.Column("title", sa.String, nullable=False),
        sa.Column("body", sa.Text, server_default=""),
        sa.Column("stale_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )
    op.create_table(
        "ingest_cursor",
        sa.Column("source", sa.String, primary_key=True),
        sa.Column("byte_offset", sa.Integer, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.current_timestamp()),
    )

    op.execute(
        "CREATE VIRTUAL TABLE memory_fts USING fts5("
        "title, body, content='memory_entries', content_rowid='id',"
        " tokenize='porter unicode61')"
    )
    op.execute(
        "CREATE TRIGGER memory_fts_ai AFTER INSERT ON memory_entries BEGIN "
        "INSERT INTO memory_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END"
    )
    op.execute(
        "CREATE TRIGGER memory_fts_ad AFTER DELETE ON memory_entries BEGIN "
        "INSERT INTO memory_fts(memory_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body); END"
    )
    op.execute(
        "CREATE TRIGGER memory_fts_au AFTER UPDATE ON memory_entries BEGIN "
        "INSERT INTO memory_fts(memory_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body); "
        "INSERT INTO memory_fts(rowid, title, body) VALUES (new.id, new.title, new.body); END"
    )


def downgrade():
    op.execute("DROP TABLE IF EXISTS memory_fts")
    for t in (
        "ingest_cursor",
        "wiki_pages",
        "provenance_edges",
        "recalls",
        "memory_entries",
        "events",
        "sessions",
        "projects",
        "agents",
    ):
        op.drop_table(t)
