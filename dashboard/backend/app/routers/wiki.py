from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import MemoryEntry, ProvenanceEdge
from ..schemas import (
    WikiTreeOut, WikiPageOut, WikiPageSummary, WikiHealthOut, WikiBacklinkOut,
)
from ..wiki import reader, bridge

router = APIRouter(prefix="/wiki", tags=["wiki"])


@router.get("/tree", response_model=WikiTreeOut)
def wiki_tree() -> WikiTreeOut:
    return WikiTreeOut(**reader.tree())


@router.get("/pages", response_model=list[WikiPageSummary])
def wiki_pages(subdir: str, limit: int = 100, offset: int = 0) -> list[WikiPageSummary]:
    try:
        rows = reader.pages(subdir, limit=limit, offset=offset)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return [WikiPageSummary(**r) for r in rows]


@router.get("/page", response_model=WikiPageOut)
def wiki_page(path: str) -> WikiPageOut:
    try:
        return WikiPageOut(**reader.page(path))
    except FileNotFoundError:
        raise HTTPException(404, "page not found")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/health", response_model=WikiHealthOut)
def wiki_health() -> WikiHealthOut:
    try:
        lint_result = bridge.lint(reader.fabric_dir())
    except Exception as exc:
        lint_result = {
            "page_count": 0,
            "broken_links": [],
            "orphan_pages": [],
            "pages_without_sources": [],
            "status": "unavailable",
            "reason": str(exc),
        }
    try:
        llm = bridge.llm_status(live=False)
    except Exception as exc:
        llm = {
            "provider": None,
            "model": None,
            "status": "unavailable",
            "reason": str(exc),
        }
    return WikiHealthOut(
        page_count=int(lint_result.get("page_count") or 0),
        broken_links=lint_result.get("broken_links") or [],
        orphan_pages=lint_result.get("orphan_pages") or [],
        pages_without_sources=lint_result.get("pages_without_sources") or [],
        status=str(lint_result.get("status") or "ok"),
        llm={
            "provider": llm.get("provider"),
            "model": llm.get("model"),
            "status": llm.get("status"),
            "reason": llm.get("reason"),
        },
    )


@router.get("/backlinks", response_model=list[WikiBacklinkOut])
def wiki_backlinks(
    memory_entry_id: int = Query(...), db: DBSession = Depends(get_db),
) -> list[WikiBacklinkOut]:
    rows = db.execute(
        select(ProvenanceEdge).where(and_(
            ProvenanceEdge.src_type == "memory_entry",
            ProvenanceEdge.src_id == str(memory_entry_id),
            ProvenanceEdge.relation == "promoted_from",
        ))
    ).scalars().all()
    out: list[WikiBacklinkOut] = []
    for edge in rows:
        try:
            p = reader.page(edge.dst_id)
            out.append(WikiBacklinkOut(path=p["path"], title=p["title"]))
        except FileNotFoundError:
            continue
        except Exception:
            continue
    return out
