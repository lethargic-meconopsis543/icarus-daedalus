from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Iterable
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from ..models import MemoryEntry
from .search import fts_search

W_RELEVANCE = 0.5
W_RECENCY = 0.2
W_REUSE = 0.2
W_TRUST = 0.1


def _normalize(values: list[float]) -> list[float]:
    if not values:
        return []
    mx = max(values)
    if mx <= 0:
        return [0.0] * len(values)
    return [v / mx for v in values]


def _recency(created_at: datetime) -> float:
    if created_at is None:
        return 0.0
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    age_days = (datetime.now(timezone.utc) - created_at).total_seconds() / 86400
    return math.exp(-age_days / 30)


def _trust(verified_at) -> float:
    return 1.0 if verified_at else 0.3


def rank(
    db: DBSession,
    query: str,
    candidate_ids: list[int] | None = None,
    limit: int = 20,
) -> list[dict]:
    fts_hits = fts_search(db, query, limit=200) if query else []
    fts_map = {eid: score for eid, score in fts_hits}

    stmt = select(MemoryEntry)
    if candidate_ids is not None:
        stmt = stmt.where(MemoryEntry.id.in_(candidate_ids))
    elif fts_map:
        stmt = stmt.where(MemoryEntry.id.in_(list(fts_map.keys())))
    else:
        stmt = stmt.order_by(MemoryEntry.created_at.desc()).limit(limit)

    entries = db.execute(stmt).scalars().all()
    if not entries:
        return []

    rel_raw = [fts_map.get(e.id, 0.0) for e in entries]
    rec_raw = [_recency(e.created_at) for e in entries]
    reuse_raw = [math.log1p(e.reuse_count) for e in entries]
    trust_raw = [_trust(e.verified_at) for e in entries]

    rel_n = _normalize(rel_raw)
    reuse_n = _normalize(reuse_raw)

    ranked = []
    for i, e in enumerate(entries):
        signals = {
            "relevance": rel_n[i] if rel_n else 0.0,
            "recency": rec_raw[i],
            "reuse": reuse_n[i] if reuse_n else 0.0,
            "trust": trust_raw[i],
        }
        score = (
            W_RELEVANCE * signals["relevance"]
            + W_RECENCY * signals["recency"]
            + W_REUSE * signals["reuse"]
            + W_TRUST * signals["trust"]
        )
        ranked.append({"entry": e, "score": score, "signals": signals})

    ranked.sort(key=lambda r: r["score"], reverse=True)
    return ranked[:limit]
