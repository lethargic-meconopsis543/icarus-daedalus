from __future__ import annotations

import re
from sqlalchemy import text
from sqlalchemy.orm import Session as DBSession


_TOKEN = re.compile(r"[A-Za-z0-9]+")


def sanitize_query(q: str) -> str:
    tokens = _TOKEN.findall(q or "")
    if not tokens:
        return ""
    return " OR ".join(f"{t}*" for t in tokens)


def fts_search(db: DBSession, query: str, limit: int = 50) -> list[tuple[int, float]]:
    """Return (entry_id, -bm25) pairs. Higher = more relevant."""
    q = sanitize_query(query)
    if not q:
        return []
    rows = db.execute(
        text(
            "SELECT rowid, bm25(memory_fts) AS score FROM memory_fts "
            "WHERE memory_fts MATCH :q ORDER BY score LIMIT :lim"
        ),
        {"q": q, "lim": limit},
    ).all()
    return [(r[0], -float(r[1])) for r in rows]
