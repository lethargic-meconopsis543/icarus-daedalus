from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session as DBSession

from ..models import MemoryEntry, Recall


def _since(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def recall_success_rate(db: DBSession, days: int = 7) -> tuple[float, int]:
    since = _since(days)
    total = db.scalar(
        select(func.count(Recall.id)).where(
            Recall.created_at >= since, Recall.was_useful.is_not(None)
        )
    ) or 0
    useful = db.scalar(
        select(func.count(Recall.id)).where(
            Recall.created_at >= since, Recall.was_useful.is_(True)
        )
    ) or 0
    if total == 0:
        return 0.0, 0
    return useful / total, total


def reuse_rate(db: DBSession, days: int = 7) -> float:
    since = _since(days)
    total = db.scalar(
        select(func.count(MemoryEntry.id)).where(MemoryEntry.created_at >= since)
    ) or 0
    if total == 0:
        return 0.0
    reused = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(MemoryEntry.created_at >= since, MemoryEntry.reuse_count > 0)
        )
    ) or 0
    return reused / total


def verification_rate(db: DBSession, days: int = 7) -> float:
    since = _since(days)
    total = db.scalar(
        select(func.count(MemoryEntry.id)).where(MemoryEntry.created_at >= since)
    ) or 0
    if total == 0:
        return 0.0
    verified = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(MemoryEntry.created_at >= since, MemoryEntry.verified_at.is_not(None))
        )
    ) or 0
    return verified / total


def entries_today(db: DBSession) -> int:
    since = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.scalar(
        select(func.count(MemoryEntry.id)).where(MemoryEntry.created_at >= since)
    ) or 0


def write_volume(db: DBSession, agent_id: str, days: int = 7) -> int:
    since = _since(days)
    return db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(MemoryEntry.author_agent_id == agent_id, MemoryEntry.created_at >= since)
        )
    ) or 0


def agent_reuse_rate(db: DBSession, agent_id: str, days: int = 7) -> float:
    since = _since(days)
    total = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(MemoryEntry.author_agent_id == agent_id, MemoryEntry.created_at >= since)
        )
    ) or 0
    if total == 0:
        return 0.0
    reused = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(
                MemoryEntry.author_agent_id == agent_id,
                MemoryEntry.created_at >= since,
                MemoryEntry.reuse_count > 0,
            )
        )
    ) or 0
    return reused / total


def agent_verification_rate(db: DBSession, agent_id: str, days: int = 7) -> float:
    since = _since(days)
    total = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(MemoryEntry.author_agent_id == agent_id, MemoryEntry.created_at >= since)
        )
    ) or 0
    if total == 0:
        return 0.0
    verified = db.scalar(
        select(func.count(MemoryEntry.id)).where(
            and_(
                MemoryEntry.author_agent_id == agent_id,
                MemoryEntry.created_at >= since,
                MemoryEntry.verified_at.is_not(None),
            )
        )
    ) or 0
    return verified / total


def writes_by_day(db: DBSession, agent_id: str, days: int = 14) -> list[dict]:
    since = _since(days)
    rows = db.execute(
        select(
            func.date(MemoryEntry.created_at).label("d"),
            func.count(MemoryEntry.id),
        )
        .where(
            and_(MemoryEntry.author_agent_id == agent_id, MemoryEntry.created_at >= since)
        )
        .group_by("d")
        .order_by("d")
    ).all()
    return [{"date": str(r[0]), "count": int(r[1])} for r in rows]
