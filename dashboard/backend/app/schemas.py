from __future__ import annotations

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    platform: str
    status: str
    current_task: str | None = None
    last_seen_at: datetime | None = None


class EventOut(BaseModel):
    id: int
    agent_id: str | None = None
    agent_name: str | None = None
    session_id: str | None = None
    source: str
    kind: str
    payload: dict[str, Any] = {}
    occurred_at: datetime


class MemoryEntryOut(BaseModel):
    id: int
    author_agent_id: str | None = None
    author_name: str | None = None
    session_id: str | None = None
    project_id: str | None = None
    kind: str
    source: str
    title: str
    body: str
    verified_at: datetime | None = None
    reuse_count: int
    created_at: datetime
    updated_at: datetime


class RankedEntry(MemoryEntryOut):
    score: float
    signals: dict[str, float]


class RecallOut(BaseModel):
    id: int
    agent_id: str | None
    session_id: str | None
    source: str
    query: str
    returned_entry_ids: list[int]
    was_useful: bool | None
    created_at: datetime


class ProvenanceEdgeOut(BaseModel):
    id: int
    src_type: str
    src_id: str
    dst_type: str
    dst_id: str
    relation: str
    created_at: datetime


class FleetCounts(BaseModel):
    healthy: int = 0
    idle: int = 0
    stale: int = 0
    offline: int = 0
    blocked: int = 0


class FleetMetrics(BaseModel):
    recall_success_rate: float
    recall_sample_size: int
    reuse_rate: float
    verification_rate: float
    entries_today: int
    promotions_today: int
    stale_knowledge_count: int
    contradiction_count: int
    unresolved_handoffs: int


class ProjectActivity(BaseModel):
    project_id: str
    name: str
    entries_24h: int


class FleetOut(BaseModel):
    agents: list[AgentOut]
    counts: FleetCounts
    metrics: FleetMetrics
    highlights: list[MemoryEntryOut]
    projects: list[ProjectActivity]


class AgentDetailOut(BaseModel):
    agent: AgentOut
    recent_writes: list[MemoryEntryOut]
    recent_recalls: list[RecallOut]
    contribution: dict[str, float]
    writes_by_day: list[dict[str, Any]]


class RetrieveIn(BaseModel):
    query: str
    agent_id: str | None = None
    project_id: str | None = None
    kind: str | None = None
    verified: bool | None = None
    since: datetime | None = None
    limit: int = 20


class MemoryDetailOut(MemoryEntryOut):
    edges_in: list[ProvenanceEdgeOut] = Field(default_factory=list)
    edges_out: list[ProvenanceEdgeOut] = Field(default_factory=list)
    recalled_by: list[RecallOut] = Field(default_factory=list)


class WikiSubdirCount(BaseModel):
    name: str
    count: int


class WikiTreeOut(BaseModel):
    subdirs: list[WikiSubdirCount]
    total_pages: int
    updated_at: str | None
    wiki_dir: str


class WikiForwardLink(BaseModel):
    target: str
    path: str | None
    resolved: bool


class WikiBacklink(BaseModel):
    path: str
    title: str


class WikiPageOut(BaseModel):
    path: str
    slug: str
    title: str
    body_md: str
    forward_links: list[WikiForwardLink]
    backlinks: list[WikiBacklink]
    sources: list[dict]
    updated_at: str
    frontmatter: dict


class WikiPageSummary(BaseModel):
    slug: str
    path: str
    title: str
    updated_at: str
    size_bytes: int


class LintIssue(BaseModel):
    page: str | None = None
    missing: str | None = None


class WikiHealthOut(BaseModel):
    page_count: int
    broken_links: list[dict] = Field(default_factory=list)
    orphan_pages: list[str] = Field(default_factory=list)
    pages_without_sources: list[str] = Field(default_factory=list)
    status: str = "ok"
    llm: dict = Field(default_factory=dict)


class WikiBacklinkOut(BaseModel):
    path: str
    title: str


class SourceCountOut(BaseModel):
    source: str
    count: int


class SourceDebugOut(BaseModel):
    agents: list[SourceCountOut]
    events: list[SourceCountOut]
    memory_entries: list[SourceCountOut]
    recalls: list[SourceCountOut]
