from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Agent
from app.routers import agents


def test_agent_detail_refreshes_stale_status_from_last_seen(test_env):
    SessionLocal = test_env["SessionLocal"]

    with SessionLocal() as db:
        db.add(
            Agent(
                id="icarus",
                name="Icarus",
                status="healthy",
                current_task=None,
                last_seen_at=datetime.now(timezone.utc) - timedelta(minutes=20),
            )
        )
        db.commit()

    with SessionLocal() as db:
        detail = agents.agent_detail("icarus", db=db)

    assert detail.agent.status == "stale"
