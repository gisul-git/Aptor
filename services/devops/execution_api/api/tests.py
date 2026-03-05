from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Query, Request

from db.mongodb import get_database
from schemas.test import DevOpsTestCreate, DevOpsTestUpdate
from utils.mongo import serialize_document

router = APIRouter(prefix="/api/v1/devops/tests", tags=["devops-tests"])


def _normalize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    serialized = serialize_document(doc)
    if serialized is None:
        return None
    question_ids = serialized.get("question_ids")
    if isinstance(question_ids, list):
        serialized["question_ids"] = [str(qid) for qid in question_ids]
    return serialized


def _get_actor_id(request: Request) -> str:
    return request.headers.get("x-user-id") or request.headers.get("x-actor-id") or "local-dev-user"


async def _materialize_inline_questions(
    db: Any, actor_id: str, test_payload: Dict[str, Any], inline_questions: List[Dict[str, Any]]
) -> None:
    if not inline_questions:
        return
    question_ids: List[str] = test_payload.get("question_ids") or []
    now = datetime.utcnow()
    for q in inline_questions:
        q_doc = {
            "title": q.get("title", "Untitled DevOps Question"),
            "description": q.get("description", ""),
            "difficulty": q.get("difficulty", "medium"),
            "kind": q.get("kind", "command"),
            "points": q.get("points", 10),
            "instructions": q.get("instructions", []),
            "constraints": q.get("constraints", []),
            "hints": q.get("hints", []),
            "starter_code": q.get("starter_code") or q.get("starterCode") or {},
            "public_testcases": q.get("public_testcases", []),
            "hidden_testcases": q.get("hidden_testcases", []),
            "ai_generated": q.get("ai_generated", False),
            "is_published": q.get("is_published", True),
            "created_by": actor_id,
            "created_at": now,
            "updated_at": now,
            "module_type": "devops",
        }
        inserted = await db.devops_questions.insert_one(q_doc)
        question_ids.append(str(inserted.inserted_id))
    test_payload["question_ids"] = question_ids


@router.get("/", response_model=Dict[str, Any])
async def list_tests(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
) -> Dict[str, Any]:
    db = get_database()
    actor_id = _get_actor_id(request)
    skip = (page - 1) * limit
    query: Dict[str, Any] = {"created_by": actor_id}
    docs = await db.devops_tests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return {"success": True, "data": [_normalize_doc(d) for d in docs]}


@router.post("/", response_model=Dict[str, Any])
async def create_test(payload: DevOpsTestCreate, request: Request) -> Dict[str, Any]:
    db = get_database()
    actor_id = _get_actor_id(request)
    now = datetime.utcnow()
    test_data = payload.model_dump()
    inline_questions = test_data.pop("questions", []) or []
    if test_data.get("duration") is not None:
        test_data["duration_minutes"] = int(test_data["duration"])
    test_data.pop("duration", None)

    raw_ids = test_data.get("question_ids") or []
    test_data["question_ids"] = [str(qid) for qid in raw_ids]
    await _materialize_inline_questions(db, actor_id, test_data, inline_questions)

    test_data["created_by"] = actor_id
    test_data["is_active"] = True
    test_data["is_published"] = False
    test_data["test_type"] = "devops"
    test_data["created_at"] = now
    test_data["updated_at"] = now
    result = await db.devops_tests.insert_one(test_data)
    created = await db.devops_tests.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}


@router.get("/{test_id}", response_model=Dict[str, Any])
async def get_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    doc = await db.devops_tests.find_one({"_id": ObjectId(test_id), "created_by": actor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True, "data": _normalize_doc(doc)}


@router.put("/{test_id}", response_model=Dict[str, Any])
async def update_test(test_id: str, payload: DevOpsTestUpdate, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "question_ids" in updates and isinstance(updates["question_ids"], list):
        updates["question_ids"] = [str(qid) for qid in updates["question_ids"]]
    if updates:
        updates["updated_at"] = datetime.utcnow()
    result = await db.devops_tests.update_one(
        {"_id": ObjectId(test_id), "created_by": actor_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    updated = await db.devops_tests.find_one({"_id": ObjectId(test_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.delete("/{test_id}", response_model=Dict[str, Any])
async def delete_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    result = await db.devops_tests.delete_one({"_id": ObjectId(test_id), "created_by": actor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True, "message": "Test deleted successfully"}


@router.patch("/{test_id}/publish", response_model=Dict[str, Any])
async def publish_test(
    test_id: str,
    request: Request,
    is_published: Optional[bool] = Query(None),
    body: Optional[Dict[str, Any]] = Body(default=None),
) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    published = is_published
    if published is None and body:
        value = body.get("is_published")
        if isinstance(value, bool):
            published = value
    if published is None:
        raise HTTPException(status_code=400, detail="is_published is required")
    result = await db.devops_tests.update_one(
        {"_id": ObjectId(test_id), "created_by": actor_id},
        {"$set": {"is_published": published, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    updated = await db.devops_tests.find_one({"_id": ObjectId(test_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.post("/{test_id}/pause", response_model=Dict[str, Any])
async def pause_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    result = await db.devops_tests.update_one(
        {"_id": ObjectId(test_id), "created_by": actor_id},
        {"$set": {"is_active": False, "pausedAt": datetime.utcnow(), "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True, "message": "Test paused"}


@router.post("/{test_id}/resume", response_model=Dict[str, Any])
async def resume_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    result = await db.devops_tests.update_one(
        {"_id": ObjectId(test_id), "created_by": actor_id},
        {"$set": {"is_active": True, "pausedAt": None, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True, "message": "Test resumed"}


@router.post("/{test_id}/clone", response_model=Dict[str, Any])
async def clone_test(
    test_id: str,
    request: Request,
    body: Optional[Dict[str, Any]] = Body(default=None),
) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_database()
    actor_id = _get_actor_id(request)
    existing = await db.devops_tests.find_one({"_id": ObjectId(test_id), "created_by": actor_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Test not found")

    payload = body or {}
    keep_schedule = bool(payload.get("keepSchedule", False))
    keep_candidates = bool(payload.get("keepCandidates", False))
    new_title = payload.get("newTitle") or f"{existing.get('title', 'DevOps Test')} (Copy)"

    now = datetime.utcnow()
    clone_payload = {k: v for k, v in existing.items() if k != "_id"}
    clone_payload["title"] = new_title
    clone_payload["created_at"] = now
    clone_payload["updated_at"] = now
    clone_payload["is_published"] = False
    clone_payload["is_active"] = True
    clone_payload["pausedAt"] = None
    clone_payload["cloned_from"] = str(existing["_id"])
    if not keep_schedule:
        clone_payload["start_time"] = None
        clone_payload["end_time"] = None
        if isinstance(clone_payload.get("schedule"), dict):
            clone_payload["schedule"]["startTime"] = None
            clone_payload["schedule"]["endTime"] = None
    if not keep_candidates:
        clone_payload["invited_users"] = []

    result = await db.devops_tests.insert_one(clone_payload)
    created = await db.devops_tests.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}
