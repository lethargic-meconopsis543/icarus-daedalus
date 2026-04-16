from __future__ import annotations

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, and_
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import MemoryEntry, Recall, ProvenanceEdge, Event
from ..schemas import (
    MemoryEntryOut, MemoryDetailOut, RankedEntry, RetrieveIn,
    RecallOut, ProvenanceEdgeOut,
)
from ..ingest.handlers import _apply_recall_effects
from ..retrieval.ranker import rank

router = APIRouter(tags=["memory"])


def _to_out(entry: MemoryEntry, author_name: str | None = None) -> MemoryEntryOut:
    return MemoryEntryOut(
        id=entry.id,
        author_agent_id=entry.author_agent_id,
        author_name=author_name,
        session_id=entry.session_id,
        project_id=entry.project_id,
        kind=entry.kind,
        source=entry.source,
        title=entry.title,
        body=entry.body,
        verified_at=entry.verified_at,
        reuse_count=entry.reuse_count,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


def _apply_filters(stmt, agent_id, project_id, kind, verified, since):
    if agent_id:
        stmt = stmt.where(MemoryEntry.author_agent_id == agent_id)
    if project_id:
        stmt = stmt.where(MemoryEntry.project_id == project_id)
    if kind:
        stmt = stmt.where(MemoryEntry.kind == kind)
    if verified is True:
        stmt = stmt.where(MemoryEntry.verified_at.is_not(None))
    if verified is False:
        stmt = stmt.where(MemoryEntry.verified_at.is_(None))
    if since:
        stmt = stmt.where(MemoryEntry.created_at >= since)
    return stmt


@router.get("/memory")
def list_memory(
    q: str | None = None,
    agent_id: str | None = None,
    project_id: str | None = None,
    kind: str | None = None,
    verified: bool | None = None,
    since: datetime | None = None,
    limit: int = 30,
    offset: int = 0,
    db: DBSession = Depends(get_db),
):
    if q:
        candidate_ids = None
        if any(v is not None for v in (agent_id, project_id, kind, verified, since)):
            id_stmt = _apply_filters(select(MemoryEntry.id), agent_id, project_id, kind, verified, since)
            candidate_ids = list(db.execute(id_stmt).scalars().all())
            if not candidate_ids:
                return []
        ranked = rank(db, q, candidate_ids=candidate_ids, limit=limit + offset)
        sliced = ranked[offset:offset + limit]
        out = []
        for r in sliced:
            base = _to_out(r["entry"])
            out.append(RankedEntry(**base.model_dump(), score=r["score"], signals=r["signals"]))
        return out

    stmt = _apply_filters(select(MemoryEntry), agent_id, project_id, kind, verified, since)
    stmt = stmt.order_by(desc(MemoryEntry.created_at)).limit(limit).offset(offset)
    entries = db.execute(stmt).scalars().all()
    return [_to_out(e) for e in entries]


@router.get("/memory/top-recalled", response_model=list[MemoryEntryOut])
def top_recalled(window_days: int = 7, limit: int = 10, db: DBSession = Depends(get_db)):
    from datetime import timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    recalls = db.execute(
        select(Recall).where(Recall.created_at >= since)
    ).scalars().all()
    counter: dict[int, int] = {}
    for r in recalls:
        for eid in (r.returned_entry_ids or []):
            counter[int(eid)] = counter.get(int(eid), 0) + 1
    top_ids = [eid for eid, _ in sorted(counter.items(), key=lambda x: -x[1])[:limit]]
    if not top_ids:
        return []
    entries = db.execute(select(MemoryEntry).where(MemoryEntry.id.in_(top_ids))).scalars().all()
    order = {eid: i for i, eid in enumerate(top_ids)}
    entries.sort(key=lambda e: order.get(e.id, 999))
    return [_to_out(e) for e in entries]


@router.get("/memory/top-reused", response_model=list[MemoryEntryOut])
def top_reused(limit: int = 10, db: DBSession = Depends(get_db)):
    entries = db.execute(
        select(MemoryEntry)
        .where(MemoryEntry.reuse_count > 0)
        .order_by(desc(MemoryEntry.reuse_count), desc(MemoryEntry.updated_at))
        .limit(limit)
    ).scalars().all()
    return [_to_out(e) for e in entries]


@router.get("/memory/{entry_id}", response_model=MemoryDetailOut)
def memory_detail(entry_id: int, db: DBSession = Depends(get_db)) -> MemoryDetailOut:
    e = db.get(MemoryEntry, entry_id)
    if e is None:
        raise HTTPException(404, "entry not found")

    edges_in = db.execute(
        select(ProvenanceEdge).where(
            and_(ProvenanceEdge.dst_type == "memory_entry", ProvenanceEdge.dst_id == str(entry_id))
        )
    ).scalars().all()
    edges_out = db.execute(
        select(ProvenanceEdge).where(
            and_(ProvenanceEdge.src_type == "memory_entry", ProvenanceEdge.src_id == str(entry_id))
        )
    ).scalars().all()
    recalled_ids = [int(r.src_id) for r in edges_in if r.src_type == "recall"]
    recalled = db.execute(select(Recall).where(Recall.id.in_(recalled_ids))).scalars().all() if recalled_ids else []

    base = _to_out(e).model_dump()
    return MemoryDetailOut(
        **base,
        edges_in=[ProvenanceEdgeOut.model_validate(x, from_attributes=True) for x in edges_in],
        edges_out=[ProvenanceEdgeOut.model_validate(x, from_attributes=True) for x in edges_out],
        recalled_by=[RecallOut.model_validate(r, from_attributes=True) for r in recalled],
    )


@router.post("/retrieve", response_model=list[RankedEntry])
def retrieve(body: RetrieveIn, db: DBSession = Depends(get_db)):
    def _log_recall(result_ids: list[int]) -> None:
        recall = Recall(
            agent_id=body.agent_id,
            source="dashboard_ui",
            query=body.query,
            returned_entry_ids=result_ids,
        )
        db.add(recall)
        db.flush()
        _apply_recall_effects(db, recall, result_ids)
        db.add(Event(
            agent_id=recall.agent_id,
            session_id=recall.session_id,
            source=recall.source,
            kind="recall",
            payload={"query": recall.query, "count": len(result_ids), "was_useful": recall.was_useful},
            occurred_at=recall.created_at,
        ))
        db.commit()

    candidate_ids = None
    if any(v is not None for v in (body.agent_id, body.project_id, body.kind, body.verified, body.since)):
        id_stmt = _apply_filters(
            select(MemoryEntry.id),
            body.agent_id,
            body.project_id,
            body.kind,
            body.verified,
            body.since,
        )
        candidate_ids = list(db.execute(id_stmt).scalars().all())
        if not candidate_ids:
            _log_recall([])
            return []

    ranked = rank(db, body.query, candidate_ids=candidate_ids, limit=body.limit + 50)
    out: list[RankedEntry] = []
    for r in ranked:
        e = r["entry"]
        base = _to_out(e)
        out.append(RankedEntry(**base.model_dump(), score=r["score"], signals=r["signals"]))
        if len(out) >= body.limit:
            break

    _log_recall([x.id for x in out])
    return out
