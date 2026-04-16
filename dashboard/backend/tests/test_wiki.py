from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Agent, IngestCursor, MemoryEntry, ProvenanceEdge
from app.routers import wiki
from app.wiki import bridge, worker


def test_wiki_health_returns_unavailable_when_bridge_fails(monkeypatch, test_env):
    monkeypatch.setattr(bridge, "lint", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("lint boom")))
    monkeypatch.setattr(bridge, "llm_status", lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("llm boom")))

    out = wiki.wiki_health()

    assert out.status == "unavailable"
    assert out.page_count == 0
    assert out.llm["status"] == "unavailable"
    assert out.llm["reason"] == "llm boom"


def test_worker_reprocesses_updated_entry_and_refreshes_raw_copy(monkeypatch, test_env):
    SessionLocal = test_env["SessionLocal"]
    fabric_dir = test_env["fabric_dir"]

    src = fabric_dir.parent / "source.md"
    src.write_text("v1", encoding="utf-8")

    with SessionLocal() as db:
        db.add(Agent(id="icarus", name="Icarus"))
        db.add(
            MemoryEntry(
                id=1,
                author_agent_id="icarus",
                title="Source-backed note",
                body="first body",
                source_path=str(src),
                created_at=datetime.now(timezone.utc) - timedelta(minutes=2),
                updated_at=datetime.now(timezone.utc) - timedelta(minutes=2),
            )
        )
        db.commit()

    calls: list[str] = []

    def fake_init(_fabric_dir):
        root = fabric_dir / "wiki" / "topics"
        root.mkdir(parents=True, exist_ok=True)
        return {"status": "ok"}

    def fake_ingest(source_path, _fabric_dir):
        calls.append(str(source_path))
        page = fabric_dir / "wiki" / "topics" / "demo.md"
        page.write_text("# Demo\n", encoding="utf-8")
        return {"pages_created": [str(page)], "pages_updated": [], "extraction_mode": "heuristic"}

    monkeypatch.setattr(bridge, "init_wiki", fake_init)
    monkeypatch.setattr(bridge, "ingest", fake_ingest)

    first = worker.tick()
    assert first == {"processed": 1, "promotions": 1, "error": None}

    raw_copy = fabric_dir / "raw" / "icarus" / src.name
    assert raw_copy.read_text("utf-8") == "v1"

    with SessionLocal() as db:
        edge_count = db.query(ProvenanceEdge).count()
        assert edge_count == 1
        first_cursor = db.get(IngestCursor, worker.SOURCE)
        assert first_cursor is not None
        first_watermark = first_cursor.byte_offset

        row = db.get(MemoryEntry, 1)
        row.body = "second body"
        row.updated_at = datetime.now(timezone.utc)
        db.commit()

    src.write_text("v2", encoding="utf-8")
    second = worker.tick()
    assert second == {"processed": 1, "promotions": 0, "error": None}

    assert raw_copy.read_text("utf-8") == "v2"
    assert len(calls) == 2

    with SessionLocal() as db:
        second_cursor = db.get(IngestCursor, worker.SOURCE)
        assert second_cursor is not None
        assert second_cursor.byte_offset > first_watermark
        assert db.query(ProvenanceEdge).count() == 1
