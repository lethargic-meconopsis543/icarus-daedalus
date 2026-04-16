from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import Agent, MemoryEntry, Recall
from ..schemas import AgentOut, AgentDetailOut, MemoryEntryOut, RecallOut
from .fleet import _refresh_agent_status
from ..services import metrics as M

router = APIRouter(tags=["agents"])


@router.get("/agents", response_model=list[AgentOut])
def list_agents(db: DBSession = Depends(get_db)) -> list[AgentOut]:
    agents = db.execute(select(Agent).order_by(Agent.name)).scalars().all()
    for agent in agents:
        _refresh_agent_status(agent)
    return [AgentOut.model_validate(a) for a in agents]


@router.get("/agents/{agent_id}", response_model=AgentDetailOut)
def agent_detail(agent_id: str, db: DBSession = Depends(get_db)) -> AgentDetailOut:
    a = db.get(Agent, agent_id)
    if a is None:
        raise HTTPException(404, "agent not found")
    _refresh_agent_status(a)

    writes = db.execute(
        select(MemoryEntry)
        .where(MemoryEntry.author_agent_id == agent_id)
        .order_by(desc(MemoryEntry.created_at))
        .limit(20)
    ).scalars().all()

    recalls = db.execute(
        select(Recall)
        .where(Recall.agent_id == agent_id)
        .order_by(desc(Recall.created_at))
        .limit(20)
    ).scalars().all()

    return AgentDetailOut(
        agent=AgentOut.model_validate(a),
        recent_writes=[MemoryEntryOut.model_validate(w, from_attributes=True) for w in writes],
        recent_recalls=[RecallOut.model_validate(r, from_attributes=True) for r in recalls],
        contribution={
            "write_volume_7d": float(M.write_volume(db, agent_id)),
            "reuse_rate": M.agent_reuse_rate(db, agent_id),
            "verification_rate": M.agent_verification_rate(db, agent_id),
        },
        writes_by_day=M.writes_by_day(db, agent_id, days=14),
    )
