from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Query, Request

from db.mongodb import get_database
from schemas.question import DevOpsQuestionCreate, DevOpsQuestionUpdate
from utils.mongo import serialize_document

router = APIRouter(prefix="/api/v1/devops/questions", tags=["devops-questions"])


def _normalize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    serialized = serialize_document(doc)
    if serialized is None:
        return None
    serialized["id"] = serialized.get("id")
    return serialized


def _get_actor_id(request: Request) -> str:
    return request.headers.get("x-user-id") or request.headers.get("x-actor-id") or "local-dev-user"


@router.get("/", response_model=Dict[str, Any])
async def list_questions(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    published_only: Optional[bool] = Query(None),
) -> Dict[str, Any]:
    db = get_database()
    actor_id = _get_actor_id(request)
    query: Dict[str, Any] = {"created_by": actor_id}
    if published_only is not None:
        query["is_published"] = published_only
    docs = await db.devops_questions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return {"success": True, "data": [_normalize_doc(d) for d in docs]}


@router.post("/", response_model=Dict[str, Any])
async def create_question(payload: DevOpsQuestionCreate, request: Request) -> Dict[str, Any]:
    db = get_database()
    actor_id = _get_actor_id(request)
    now = datetime.utcnow()
    data = payload.model_dump()
    data["created_by"] = actor_id
    data["created_at"] = now
    data["updated_at"] = now
    data["module_type"] = "devops"
    result = await db.devops_questions.insert_one(data)
    created = await db.devops_questions.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}


@router.get("/{question_id}", response_model=Dict[str, Any])
async def get_question(question_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    doc = await db.devops_questions.find_one({"_id": ObjectId(question_id), "created_by": actor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "data": _normalize_doc(doc)}


@router.put("/{question_id}", response_model=Dict[str, Any])
async def update_question(question_id: str, payload: DevOpsQuestionUpdate, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.utcnow()
    result = await db.devops_questions.update_one(
        {"_id": ObjectId(question_id), "created_by": actor_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    updated = await db.devops_questions.find_one({"_id": ObjectId(question_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.patch("/{question_id}/publish", response_model=Dict[str, Any])
async def toggle_publish_question(
    question_id: str,
    request: Request,
    is_published: Optional[bool] = Query(None),
    body: Optional[Dict[str, Any]] = Body(default=None),
) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    published = is_published
    if published is None and body:
        raw = body.get("is_published")
        if isinstance(raw, bool):
            published = raw
    if published is None:
        raise HTTPException(status_code=400, detail="is_published is required")
    result = await db.devops_questions.update_one(
        {"_id": ObjectId(question_id), "created_by": actor_id},
        {"$set": {"is_published": published, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    updated = await db.devops_questions.find_one({"_id": ObjectId(question_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.delete("/{question_id}", response_model=Dict[str, Any])
async def delete_question(question_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    result = await db.devops_questions.delete_one({"_id": ObjectId(question_id), "created_by": actor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "message": "Question deleted successfully"}
