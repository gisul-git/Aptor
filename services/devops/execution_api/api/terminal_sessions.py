from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from db.mongodb import get_database


router = APIRouter(prefix="/api/internal/terminal-sessions", tags=["terminal-sessions"])


class TerminalCommandEntry(BaseModel):
    command: str = ""
    output: Optional[str] = None
    at: Optional[str] = None


class TerminalSessionPersistPayload(BaseModel):
    user_id: str = Field(default="anonymous", min_length=1)
    session_id: str = Field(min_length=1)
    started_at: datetime
    ended_at: datetime
    status: Literal["submitted", "failed", "active"] = "submitted"
    close_reason: str = "disconnect"
    transcript: str = ""
    command_history: List[Dict[str, Any] | TerminalCommandEntry] = Field(default_factory=list)


@router.post("")
async def persist_terminal_session(
    payload: TerminalSessionPersistPayload,
    x_internal_terminal: Optional[str] = Header(default=None),
):
    # Keep endpoint internal-only by requiring explicit gateway header.
    if x_internal_terminal != "1":
        raise HTTPException(status_code=403, detail="Forbidden")

    db = get_database()
    collection = db["terminal_session_logs"]

    document = payload.model_dump()
    document["updated_at"] = datetime.utcnow()
    document.setdefault("created_at", datetime.utcnow())

    await collection.update_one(
        {"session_id": payload.session_id},
        {"$set": document, "$setOnInsert": {"created_at": datetime.utcnow()}},
        upsert=True,
    )

    return {"ok": True, "session_id": payload.session_id}
