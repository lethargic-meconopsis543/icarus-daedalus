from __future__ import annotations

from datetime import datetime, timezone

from app.models import Agent, MemoryEntry, ProvenanceEdge, Recall
from app.routers import fleet, memory
from app.schemas import RetrieveIn


def test_retrieve_logs_recall_and_updates_reuse_and_provenance(test_env):
    SessionLocal = test_env["SessionLocal"]

    with SessionLocal() as db:
        db.add(Agent(id="icarus", name="Icarus"))
        db.add_all(
            [
                MemoryEntry(
                    author_agent_id="icarus",
                    kind="decision",
                    title="Deploy dashboard on Render",
                    body="Deploy flow for the dashboard uses Render.",
                    verified_at=datetime.now(timezone.utc),
                    reuse_count=0,
                ),
                MemoryEntry(
                    author_agent_id="icarus",
                    kind="fact",
                    title="Unrelated note",
                    body="This entry should rank lower.",
                    reuse_count=0,
                ),
            ]
        )
        db.commit()

    with SessionLocal() as db:
        out = memory.retrieve(RetrieveIn(query="deploy", limit=2), db=db)
        assert out
        top_id = out[0].id

    with SessionLocal() as db:
        recall = db.query(Recall).one()
        assert recall.query == "deploy"
        assert top_id in recall.returned_entry_ids

        entry = db.get(MemoryEntry, top_id)
        assert entry is not None
        assert entry.reuse_count == 1

        edge = db.query(ProvenanceEdge).filter(
            ProvenanceEdge.src_type == "recall",
            ProvenanceEdge.src_id == str(recall.id),
            ProvenanceEdge.dst_type == "memory_entry",
            ProvenanceEdge.dst_id == str(top_id),
            ProvenanceEdge.relation == "recalled_in",
        ).one_or_none()
        assert edge is not None


def test_retrieve_logs_zero_hit_recall_when_filters_eliminate_candidates(test_env):
    SessionLocal = test_env["SessionLocal"]

    with SessionLocal() as db:
        db.add(Agent(id="icarus", name="Icarus"))
        db.add(
            MemoryEntry(
                author_agent_id="icarus",
                kind="fact",
                title="Unverified deploy note",
                body="Deploy docs are still draft.",
                reuse_count=0,
            )
        )
        db.commit()

    with SessionLocal() as db:
        out = memory.retrieve(RetrieveIn(query="deploy", verified=True, limit=5), db=db)
        assert out == []

    with SessionLocal() as db:
        recalls = db.query(Recall).all()
        assert len(recalls) == 1
        assert recalls[0].query == "deploy"
        assert recalls[0].returned_entry_ids == []
        assert recalls[0].source == "dashboard_ui"


def test_debug_sources_reports_seed_memory_and_dashboard_recalls(test_env):
    SessionLocal = test_env["SessionLocal"]

    with SessionLocal() as db:
        db.add(Agent(id="icarus", name="Icarus"))
        db.add(
            MemoryEntry(
                author_agent_id="icarus",
                kind="decision",
                source="seed",
                title="Deploy target",
                body="Deploy the dashboard to the shared host.",
                reuse_count=0,
            )
        )
        db.commit()

    with SessionLocal() as db:
        out = memory.retrieve(RetrieveIn(query="deploy", limit=3), db=db)
        assert len(out) == 1

    with SessionLocal() as db:
        debug = fleet.debug_sources(db=db)

    memory_sources = {row.source: row.count for row in debug.memory_entries}
    recall_sources = {row.source: row.count for row in debug.recalls}
    event_sources = {row.source: row.count for row in debug.events}

    assert memory_sources["seed"] == 1
    assert recall_sources["dashboard_ui"] == 1
    assert event_sources["dashboard_ui"] >= 1
