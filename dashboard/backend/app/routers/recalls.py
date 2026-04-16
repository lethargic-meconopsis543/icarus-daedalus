from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from ..db import get_db
from ..models import Recall
from ..schemas import RecallOut

router = APIRouter(tags=["recalls"])


class RecallPatchIn(BaseModel):
    was_useful: bool | None = None


@router.patch("/recalls/{recall_id}", response_model=RecallOut)
def patch_recall(recall_id: int, body: RecallPatchIn, db: DBSession = Depends(get_db)) -> RecallOut:
    r = db.get(Recall, recall_id)
    if r is None:
        raise HTTPException(404, "recall not found")
    r.was_useful = body.was_useful
    db.commit()
    db.refresh(r)
    return RecallOut.model_validate(r, from_attributes=True)
