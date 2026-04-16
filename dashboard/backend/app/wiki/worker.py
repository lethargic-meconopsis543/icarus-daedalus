"""Background worker that promotes new memory_entries into the wiki."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from ..db import SessionLocal
from ..models import IngestCursor, MemoryEntry, ProvenanceEdge
from . import bridge, reader

logger = logging.getLogger("icarus.wiki.worker")

SOURCE = "wiki_worker"
IDLE_INTERVAL = 15.0
BUSY_INTERVAL = 2.0
ERROR_MAX_INTERVAL = 300.0
BATCH_SIZE = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _events_path() -> Path:
    return reader.fabric_dir() / "events.jsonl"


def _get_cursor(db) -> int:
    row = db.get(IngestCursor, SOURCE)
    if row is None:
        row = IngestCursor(source=SOURCE, byte_offset=0)
        db.add(row)
        db.flush()
    return int(row.byte_offset)


def _set_cursor(db, value: int) -> None:
    row = db.get(IngestCursor, SOURCE)
    if row is None:
        row = IngestCursor(source=SOURCE, byte_offset=value)
        db.add(row)
    else:
        row.byte_offset = value


def _token_for(entry: MemoryEntry) -> int:
    ts = entry.updated_at or entry.created_at or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    millis = int(ts.timestamp() * 1000)
    return millis * 1_000_000 + (int(entry.id) % 1_000_000)


def _copy_to_raw(entry: MemoryEntry, fabric_dir: Path) -> Path | None:
    src = Path(entry.source_path) if entry.source_path else None
    if src is None or not src.exists():
        return None
    agent = (entry.author_agent_id or "agent").strip() or "agent"
    dst_dir = fabric_dir / "raw" / agent
    dst_dir.mkdir(parents=True, exist_ok=True)
    dst = dst_dir / src.name
    if (
        not dst.exists()
        or src.stat().st_mtime_ns > dst.stat().st_mtime_ns
        or src.stat().st_size != dst.stat().st_size
    ):
        shutil.copy2(src, dst)
    return dst


def _sync_promotions(db, entry_id: int, result: dict) -> int:
    pages = (result.get("pages_created") or []) + (result.get("pages_updated") or [])
    if not pages:
        return 0
    seen: set[str] = set()
    added = 0
    for page in pages:
        slug = str(page)
        try:
            slug = str(Path(page).resolve().relative_to(reader.wiki_root().resolve()))
        except Exception:
            pass
        if slug in seen:
            continue
        seen.add(slug)
        existing = db.execute(
            select(ProvenanceEdge).where(
                ProvenanceEdge.src_type == "memory_entry",
                ProvenanceEdge.src_id == str(entry_id),
                ProvenanceEdge.dst_type == "wiki_page",
                ProvenanceEdge.dst_id == slug,
                ProvenanceEdge.relation == "promoted_from",
            )
        ).scalar_one_or_none()
        if existing is not None:
            existing.created_at = datetime.now(timezone.utc)
            continue
        db.add(ProvenanceEdge(
            src_type="memory_entry",
            src_id=str(entry_id),
            dst_type="wiki_page",
            dst_id=slug,
            relation="promoted_from",
            created_at=datetime.now(timezone.utc),
        ))
        added += 1
    return added


def _append_promotions(entry_id: int, result: dict) -> int:
    pages = (result.get("pages_created") or []) + (result.get("pages_updated") or [])
    if not pages:
        return 0
    seen: set[str] = set()
    lines: list[str] = []
    for page in pages:
        slug = str(page)
        try:
            slug = str(Path(page).resolve().relative_to(reader.wiki_root().resolve()))
        except Exception:
            pass
        if slug in seen:
            continue
        seen.add(slug)
        lines.append(json.dumps({
            "type": "wiki.promotion",
            "at": _now_iso(),
            "source": "wiki_worker",
            "memory_entry_id": entry_id,
            "page_slug": slug,
            "extraction_mode": result.get("extraction_mode"),
        }))
    with _events_path().open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return len(lines)


def tick() -> dict:
    """One processing pass. Returns {processed, promotions, error}."""
    fabric_dir = reader.fabric_dir()
    try:
        bridge.init_wiki(fabric_dir)
    except Exception as exc:
        logger.warning("init_wiki failed: %s", exc)

    processed = 0
    promotions = 0
    with SessionLocal() as db:
        cursor = _get_cursor(db)
        rows = db.execute(
            select(MemoryEntry)
            .where(MemoryEntry.source_path.is_not(None))
            .order_by(MemoryEntry.updated_at, MemoryEntry.id)
        ).scalars().all()
        rows = [row for row in rows if _token_for(row) > cursor][:BATCH_SIZE]
        if not rows:
            return {"processed": 0, "promotions": 0, "error": None}

        for row in rows:
            raw = _copy_to_raw(row, fabric_dir)
            if raw is None:
                _set_cursor(db, _token_for(row))
                continue
            try:
                result = bridge.ingest(raw, fabric_dir)
            except Exception as exc:
                logger.warning("ingest failed for entry %s (%s): %s", row.id, row.source_path, exc)
                db.commit()
                return {"processed": processed, "promotions": promotions, "error": str(exc)}
            added = _sync_promotions(db, row.id, result)
            _append_promotions(row.id, result)
            promotions += added
            processed += 1
            _set_cursor(db, _token_for(row))
            logger.info(
                "[wiki] promoted %s pages for entry %s mode=%s",
                added, row.id, result.get("extraction_mode"),
            )
        db.commit()
    return {"processed": processed, "promotions": promotions, "error": None}


async def run_forever() -> None:
    logger.info("[wiki] worker enabled (fabric=%s)", reader.fabric_dir())
    delay = IDLE_INTERVAL
    while True:
        try:
            result = await asyncio.to_thread(tick)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("[wiki] tick crashed: %s", exc)
            delay = min(delay * 2, ERROR_MAX_INTERVAL)
        else:
            if result.get("error"):
                delay = min(delay * 2, ERROR_MAX_INTERVAL)
            elif result["processed"] > 0:
                delay = BUSY_INTERVAL
            else:
                delay = IDLE_INTERVAL
        await asyncio.sleep(delay)
