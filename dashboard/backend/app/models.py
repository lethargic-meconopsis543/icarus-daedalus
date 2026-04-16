from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    platform: Mapped[str] = mapped_column(String, default="hermes")
    status: Mapped[str] = mapped_column(String, default="offline")
    current_task: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"))
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class Event(Base):
    __tablename__ = "events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str | None] = mapped_column(String, ForeignKey("agents.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, ForeignKey("sessions.id"), nullable=True)
    source: Mapped[str] = mapped_column(String, default="unknown", index=True)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class MemoryEntry(Base):
    __tablename__ = "memory_entries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_agent_id: Mapped[str | None] = mapped_column(String, ForeignKey("agents.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, ForeignKey("sessions.id"), nullable=True)
    project_id: Mapped[str | None] = mapped_column(String, ForeignKey("projects.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String, default="observation")
    source: Mapped[str] = mapped_column(String, default="unknown", index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    source_path: Mapped[str | None] = mapped_column(String, nullable=True, unique=True, index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reuse_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class Recall(Base):
    __tablename__ = "recalls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[str | None] = mapped_column(String, ForeignKey("agents.id"), nullable=True)
    session_id: Mapped[str | None] = mapped_column(String, ForeignKey("sessions.id"), nullable=True)
    source: Mapped[str] = mapped_column(String, default="unknown", index=True)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    returned_entry_ids: Mapped[list] = mapped_column(JSON, default=list)
    was_useful: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class ProvenanceEdge(Base):
    __tablename__ = "provenance_edges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    src_type: Mapped[str] = mapped_column(String, nullable=False)
    src_id: Mapped[str] = mapped_column(String, nullable=False)
    dst_type: Mapped[str] = mapped_column(String, nullable=False)
    dst_id: Mapped[str] = mapped_column(String, nullable=False)
    relation: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class WikiPage(Base):
    __tablename__ = "wiki_pages"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, default="")
    stale_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class IngestCursor(Base):
    __tablename__ = "ingest_cursor"
    source: Mapped[str] = mapped_column(String, primary_key=True)
    byte_offset: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)
