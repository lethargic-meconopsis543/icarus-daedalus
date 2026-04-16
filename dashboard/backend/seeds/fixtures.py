from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from app.db import engine, SessionLocal, Base
from app.models import (
    Agent, Project, Session as SessionRow, MemoryEntry, Event, Recall, ProvenanceEdge, IngestCursor,
)

random.seed(42)
NOW = datetime.now(timezone.utc)


AGENTS = [
    ("icarus",    "Icarus",    "hermes",       "healthy",  "indexing fabric/wiki"),
    ("daedalus",  "Daedalus",  "hermes",       "idle",     None),
    ("hermes-cli","Hermes CLI","hermes-cli",   "healthy",  "draft onboarding doc"),
    ("nous-01",   "Nous Alpha","nous",         "stale",    "long-running recall test"),
    ("oracle",    "Oracle",    "hermes",       "blocked",  "waiting on user review"),
]

PROJECTS = [
    ("icarus-daedalus", "icarus-daedalus", "shared brain for agents"),
    ("hermes-dashboard","hermes-dashboard","monitoring + wiki"),
    ("fabric-adapter",  "fabric-adapter",  "cross-platform memory shim"),
]

ENTRY_TEMPLATES = [
    ("decision",    "use SQLite FTS5 for MVP search",           "Chose SQLite FTS5 over Postgres to keep the local dev loop zero-dep. Migrate if scale demands."),
    ("decision",    "deploy dashboard on Render",               "Render is already wired; avoid Vercel for the backend."),
    ("decision",    "keep ingest file-based for MVP",           "JSONL tail + cursor. Graduates cleanly to pubsub later."),
    ("fact",        "Hermes events land at ~/fabric/events.jsonl","Events are appended by the plugin; cursor persists progress."),
    ("fact",        "agents.yml lists active Hermes homes",     "Fallback when no explicit registry is configured."),
    ("failure",     "recall returned no hits for 'deploy'",     "Ranker needs a tokenizer fix — dash-separated words missed."),
    ("fix",         "normalize YAML scalars on read",           "Frontmatter readers choked on unquoted colons; quote on write."),
    ("preference",  "avoid gradients and pill badges",          "User calls decorated UI 'vibe coded slop'."),
    ("observation", "most recalls happen during onboarding",    "Telemetry shows first-hour sessions dominate recall traffic."),
    ("fix",         "obsidian vault root fix for subfolders",   "Detect vault root walking up for .obsidian marker."),
    ("decision",    "promote wiki pages on 3+ citations",       "Threshold keeps the wiki signal strong."),
    ("fact",        "icarus-plugin is canonical source",        "daedalus mirrors it; sync commits are labeled accordingly."),
    ("failure",     "export training broke on long sessions",   "Timeout at 300s; split into chunks."),
    ("fix",         "cap briefing length to keep token budget", "Briefings over 8k tokens were destabilizing small models."),
    ("preference",  "dashboard copy: concise, no emojis",       "Icarus tone is tool-grade, not marketing."),
    ("observation", "stale entries correlate with agent churn", "When an agent goes offline for 48h, ownership goes stale fast."),
    ("decision",    "ProvenanceEdge is generic, not typed",     "Phase 2 tables plug in without migration."),
    ("fact",        "recall_success is only meaningful with label","Show sample size; small-n rate is misleading."),
]


def main() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        db.query(IngestCursor).delete()
        db.query(ProvenanceEdge).delete()
        db.query(Recall).delete()
        db.query(Event).delete()
        db.query(MemoryEntry).delete()
        db.query(SessionRow).delete()
        db.query(Project).delete()
        db.query(Agent).delete()
        db.commit()

        for pid, name, desc in PROJECTS:
            db.add(Project(id=pid, name=name, description=desc))

        for aid, name, platform, status, task in AGENTS:
            last_seen = NOW - timedelta(seconds=random.randint(20, 900))
            if status == "stale": last_seen = NOW - timedelta(minutes=random.randint(15, 45))
            if status == "offline": last_seen = NOW - timedelta(hours=random.randint(2, 12))
            db.add(Agent(
                id=aid, name=name, platform=platform, status=status,
                current_task=task, last_seen_at=last_seen,
            ))

        sessions = []
        for i in range(12):
            aid = random.choice(AGENTS)[0]
            pid = random.choice(PROJECTS)[0]
            sid = f"s-{i:03d}"
            started = NOW - timedelta(hours=random.randint(1, 96))
            ended = started + timedelta(minutes=random.randint(10, 180))
            sessions.append((sid, aid, pid, started, ended))
            db.add(SessionRow(
                id=sid, agent_id=aid, project_id=pid,
                started_at=started, ended_at=ended if i % 3 else None,
                summary=f"session {i} on {pid}",
            ))
        db.commit()

        entry_ids: list[int] = []
        for _ in range(100):
            kind, title, body = random.choice(ENTRY_TEMPLATES)
            aid = random.choice(AGENTS)[0]
            sid, _, pid, _, _ = random.choice(sessions)
            created = NOW - timedelta(hours=random.randint(1, 96))
            verified = created + timedelta(minutes=20) if random.random() < 0.35 else None
            reuse = random.choices([0, 1, 2, 3, 5, 8], weights=[40, 20, 15, 10, 10, 5])[0]
            e = MemoryEntry(
                author_agent_id=aid, session_id=sid, project_id=pid,
                kind=kind, source="seed", title=title, body=body,
                created_at=created, updated_at=created,
                verified_at=verified, reuse_count=reuse,
            )
            db.add(e)
            db.flush()
            entry_ids.append(e.id)

        EVENT_KINDS = ["decision", "handoff", "review", "failure", "fix", "completion", "write", "recall", "status"]
        for _ in range(200):
            aid = random.choice(AGENTS)[0]
            sid, _, _, _, _ = random.choice(sessions)
            k = random.choice(EVENT_KINDS)
            db.add(Event(
                agent_id=aid, session_id=sid, source="seed", kind=k,
                payload={"note": f"seeded {k} event"},
                occurred_at=NOW - timedelta(minutes=random.randint(0, 48 * 60)),
            ))

        for _ in range(50):
            aid = random.choice(AGENTS)[0]
            sid, _, _, _, _ = random.choice(sessions)
            hits = random.sample(entry_ids, k=min(3, len(entry_ids)))
            useful = random.choices([True, False, None], weights=[60, 20, 20])[0]
            r = Recall(
                agent_id=aid, session_id=sid, source="seed",
                query=random.choice(["deploy", "recall fix", "obsidian", "briefing", "export", "render", "onboarding"]),
                returned_entry_ids=hits, was_useful=useful,
                created_at=NOW - timedelta(minutes=random.randint(0, 48 * 60)),
            )
            db.add(r)
            db.flush()
            for eid in hits:
                db.add(ProvenanceEdge(
                    src_type="recall", src_id=str(r.id),
                    dst_type="memory_entry", dst_id=str(eid),
                    relation="recalled_in",
                ))

        cite_pairs = random.sample([(a, b) for a in entry_ids for b in entry_ids if a != b], k=30)
        for src, dst in cite_pairs:
            db.add(ProvenanceEdge(
                src_type="memory_entry", src_id=str(src),
                dst_type="memory_entry", dst_id=str(dst),
                relation="cites",
            ))

        db.commit()
        print(f"seeded: {len(AGENTS)} agents, {len(PROJECTS)} projects, {len(sessions)} sessions, {len(entry_ids)} entries, 200 events, 50 recalls, 30 cites")


if __name__ == "__main__":
    main()
