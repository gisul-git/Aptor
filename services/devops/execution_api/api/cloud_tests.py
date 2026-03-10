from datetime import datetime
import csv
import io
import secrets
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Body, File, HTTPException, Query, Request, UploadFile

from db.mongodb import get_cloud_database
from schemas.test import DevOpsTestCreate, DevOpsTestUpdate
from utils.mongo import serialize_document

router = APIRouter(prefix="/api/v1/cloud/tests", tags=["cloud-tests"])


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


def _assessment_collections(db: Any) -> List[Any]:
    # New primary collection + backward-compatible legacy collection
    return [db.cloud_assessments, db.cloud_tests]


async def _find_test_doc(db: Any, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for col in _assessment_collections(db):
        doc = await col.find_one(query)
        if doc:
            return doc
    return None


async def _update_test_doc(db: Any, query: Dict[str, Any], updates: Dict[str, Any]) -> int:
    for col in _assessment_collections(db):
        result = await col.update_one(query, {"$set": updates})
        if result.matched_count:
            return result.matched_count
    return 0


async def _delete_test_doc(db: Any, query: Dict[str, Any]) -> int:
    for col in _assessment_collections(db):
        result = await col.delete_one(query)
        if result.deleted_count:
            return result.deleted_count
    return 0


async def _add_invited_email(db: Any, test_id: ObjectId, email: str) -> None:
    for col in _assessment_collections(db):
        result = await col.update_one({"_id": test_id}, {"$addToSet": {"invited_users": email}})
        if result.matched_count:
            return


def _normalize_email(value: str) -> str:
    return (value or "").strip().lower()


async def _materialize_inline_questions(
    db: Any, actor_id: str, test_payload: Dict[str, Any], inline_questions: List[Dict[str, Any]]
) -> None:
    if not inline_questions:
        return
    question_ids: List[str] = test_payload.get("question_ids") or []
    now = datetime.utcnow()
    for q in inline_questions:
        q_doc = {
            "title": q.get("title", "Untitled Cloud Question"),
            "description": q.get("description", ""),
            "difficulty": q.get("difficulty", "medium"),
            "kind": q.get("kind", "command"),
            "points": q.get("points", 10),
            "instructions": q.get("instructions", []),
            "constraints": q.get("constraints", []),
            "hints": q.get("hints", []),
            "validation_mode": q.get("validation_mode") or q.get("validationMode"),
            "question_type": q.get("question_type") or q.get("questionType"),
            "is_scenario_based": bool(q.get("is_scenario_based") or q.get("isScenarioBased")),
            "context": q.get("context", ""),
            "task": q.get("task", ""),
            "years_of_experience": q.get("years_of_experience") or q.get("yearsOfExperience"),
            "starter_code": q.get("starter_code") or q.get("starterCode") or {},
            "public_testcases": q.get("public_testcases", []),
            "hidden_testcases": q.get("hidden_testcases", []),
            "ai_generated": q.get("ai_generated", False),
            "is_published": q.get("is_published", True),
            "created_by": actor_id,
            "created_at": now,
            "updated_at": now,
            "module_type": "cloud",
        }
        inserted = await db.cloud_questions.insert_one(q_doc)
        question_ids.append(str(inserted.inserted_id))
    test_payload["question_ids"] = question_ids


@router.get("/", response_model=Dict[str, Any])
async def list_tests(
    request: Request,
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=200),
) -> Dict[str, Any]:
    db = get_cloud_database()
    skip = (page - 1) * limit
    query: Dict[str, Any] = {}
    primary_docs = (
        await db.cloud_assessments.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    )
    legacy_docs = (
        await db.cloud_tests.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    )

    seen: set[str] = set()
    merged: List[Dict[str, Any]] = []
    for doc in [*primary_docs, *legacy_docs]:
        sid = str(doc.get("_id"))
        if sid in seen:
            continue
        seen.add(sid)
        merged.append(doc)
    merged.sort(key=lambda d: d.get("created_at") or datetime.min, reverse=True)
    return {"success": True, "data": [_normalize_doc(d) for d in merged[:limit]]}


@router.post("/", response_model=Dict[str, Any])
async def create_test(payload: DevOpsTestCreate, request: Request) -> Dict[str, Any]:
    db = get_cloud_database()
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
    test_data["test_type"] = "cloud"
    test_data["created_at"] = now
    test_data["updated_at"] = now
    result = await db.cloud_assessments.insert_one(test_data)
    created = await db.cloud_assessments.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}


@router.get("/{test_id}", response_model=Dict[str, Any])
async def get_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    doc = await _find_test_doc(db, {"_id": ObjectId(test_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Test not found")

    normalized = _normalize_doc(doc) or {}
    raw_question_ids = normalized.get("question_ids") if isinstance(normalized.get("question_ids"), list) else []
    object_ids: List[ObjectId] = [ObjectId(qid) for qid in raw_question_ids if ObjectId.is_valid(str(qid))]
    questions: List[Dict[str, Any]] = []
    if object_ids:
        qdocs = await db.cloud_questions.find(
            {"_id": {"$in": object_ids}}
        ).to_list(length=len(object_ids))
        by_id = {str(q.get("_id")): q for q in qdocs}
        for qid in raw_question_ids:
            qdoc = by_id.get(str(qid))
            if not qdoc:
                continue
            qnorm = serialize_document(qdoc) or {}
            starter_code_raw = qnorm.get("starter_code")
            starter_code = ""
            if isinstance(starter_code_raw, dict):
                starter_code = str(starter_code_raw.get("bash") or "")
            elif isinstance(starter_code_raw, str):
                starter_code = starter_code_raw

            questions.append(
                {
                    "id": qnorm.get("id"),
                    "title": qnorm.get("title", ""),
                    "description": qnorm.get("description", ""),
                    "difficulty": qnorm.get("difficulty", "medium"),
                    "points": qnorm.get("points", 10),
                    "kind": qnorm.get("kind", "command"),
                    "validationMode": qnorm.get("validation_mode") or qnorm.get("validationMode"),
                    "questionType": qnorm.get("question_type") or qnorm.get("questionType"),
                    "isScenarioBased": bool(qnorm.get("is_scenario_based") or qnorm.get("isScenarioBased")),
                    "context": qnorm.get("context", ""),
                    "task": qnorm.get("task", ""),
                    "yearsOfExperience": qnorm.get("years_of_experience") or qnorm.get("yearsOfExperience"),
                    "instructions": qnorm.get("instructions", []),
                    "constraints": qnorm.get("constraints", []),
                    "hints": qnorm.get("hints", []),
                    "starterCode": starter_code,
                    "ai_generated": qnorm.get("ai_generated", False),
                }
            )

    normalized["questions"] = questions
    return {"success": True, "data": normalized}


@router.put("/{test_id}", response_model=Dict[str, Any])
async def update_test(test_id: str, payload: DevOpsTestUpdate, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "question_ids" in updates and isinstance(updates["question_ids"], list):
        updates["question_ids"] = [str(qid) for qid in updates["question_ids"]]
    if updates:
        updates["updated_at"] = datetime.utcnow()
    matched = await _update_test_doc(db, {"_id": ObjectId(test_id)}, updates)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    updated = await _find_test_doc(db, {"_id": ObjectId(test_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.delete("/{test_id}", response_model=Dict[str, Any])
async def delete_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    deleted = await _delete_test_doc(db, {"_id": ObjectId(test_id)})
    if deleted == 0:
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
    db = get_cloud_database()
    published = is_published
    if published is None and body:
        value = body.get("is_published")
        if isinstance(value, bool):
            published = value
    if published is None:
        raise HTTPException(status_code=400, detail="is_published is required")
    update_doc: Dict[str, Any] = {"is_published": published, "updated_at": datetime.utcnow()}
    if published:
        existing = await _find_test_doc(db, {"_id": ObjectId(test_id)})
        if not existing:
            raise HTTPException(status_code=404, detail="Test not found")
        if not existing.get("test_token"):
            update_doc["test_token"] = secrets.token_urlsafe(24)

    matched = await _update_test_doc(db, {"_id": ObjectId(test_id)}, update_doc)
    if matched == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    updated = await _find_test_doc(db, {"_id": ObjectId(test_id)})
    return {"success": True, "data": _normalize_doc(updated)}


@router.post("/{test_id}/pause", response_model=Dict[str, Any])
async def pause_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    matched = await _update_test_doc(
        db,
        {"_id": ObjectId(test_id)},
        {"is_active": False, "pausedAt": datetime.utcnow(), "updated_at": datetime.utcnow()},
    )
    if matched == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    return {"success": True, "message": "Test paused"}


@router.post("/{test_id}/resume", response_model=Dict[str, Any])
async def resume_test(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    matched = await _update_test_doc(
        db,
        {"_id": ObjectId(test_id)},
        {"is_active": True, "pausedAt": None, "updated_at": datetime.utcnow()},
    )
    if matched == 0:
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
    db = get_cloud_database()
    existing = await _find_test_doc(db, {"_id": ObjectId(test_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Test not found")

    payload = body or {}
    keep_schedule = bool(payload.get("keepSchedule", False))
    keep_candidates = bool(payload.get("keepCandidates", False))
    new_title = payload.get("newTitle") or f"{existing.get('title', 'Cloud Test')} (Copy)"

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

    result = await db.cloud_assessments.insert_one(clone_payload)
    created = await db.cloud_assessments.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}


@router.post("/{test_id}/add-candidate", response_model=Dict[str, Any])
async def add_candidate(test_id: str, request: Request, body: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    name = (body.get("name") or "").strip()
    email = _normalize_email(body.get("email") or "")
    if not name or not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid name and email are required")

    db = get_cloud_database()
    oid = ObjectId(test_id)
    test_doc = await _find_test_doc(db, {"_id": oid})
    if not test_doc:
        raise HTTPException(status_code=404, detail="Test not found")

    now = datetime.utcnow()
    existing = await db.cloud_test_candidates.find_one({"test_id": test_id, "email": email})
    if existing:
        await _add_invited_email(db, oid, email)
        return {"success": True, "data": serialize_document(existing), "duplicate": True}

    candidate_doc = {
        "test_id": test_id,
        "name": name,
        "email": email,
        "status": "invited",
        "created_at": now,
        "updated_at": now,
    }
    inserted = await db.cloud_test_candidates.insert_one(candidate_doc)
    created = await db.cloud_test_candidates.find_one({"_id": inserted.inserted_id})
    await _add_invited_email(db, oid, email)

    return {"success": True, "data": serialize_document(created)}


@router.post("/{test_id}/bulk-add-candidates", response_model=Dict[str, Any])
async def bulk_add_candidates(test_id: str, request: Request, file: UploadFile = File(...)) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")

    db = get_cloud_database()
    oid = ObjectId(test_id)
    test_doc = await _find_test_doc(db, {"_id": oid})
    if not test_doc:
        raise HTTPException(status_code=404, detail="Test not found")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded") from exc

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV must include headers")

    normalized_headers = [str(h or "").strip().lower() for h in reader.fieldnames]
    if "name" not in normalized_headers or "email" not in normalized_headers:
        raise HTTPException(status_code=400, detail="CSV must include name and email columns")

    header_map = {str(h or "").strip().lower(): h for h in reader.fieldnames}
    now = datetime.utcnow()

    success_count = 0
    failed_count = 0
    duplicate_count = 0
    errors: List[Dict[str, Any]] = []

    for idx, row in enumerate(reader, start=2):
        name = (row.get(header_map["name"]) or "").strip()
        email = _normalize_email(row.get(header_map["email"]) or "")
        if not name or not email or "@" not in email:
            failed_count += 1
            errors.append({"row": idx, "error": "Invalid name/email"})
            continue

        existing = await db.cloud_test_candidates.find_one({"test_id": test_id, "email": email})
        if existing:
            duplicate_count += 1
            await _add_invited_email(db, oid, email)
            continue

        candidate_doc = {
            "test_id": test_id,
            "name": name,
            "email": email,
            "status": "invited",
            "created_at": now,
            "updated_at": now,
        }
        await db.cloud_test_candidates.insert_one(candidate_doc)
        await _add_invited_email(db, oid, email)
        success_count += 1

    return {
        "success": True,
        "data": {
            "success_count": success_count,
            "failed_count": failed_count,
            "duplicate_count": duplicate_count,
            "errors": errors[:20],
        },
    }


@router.get("/{test_id}/candidates", response_model=Dict[str, Any])
async def get_candidates(test_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(test_id):
        raise HTTPException(status_code=400, detail="Invalid test ID")
    db = get_cloud_database()
    docs = await db.cloud_test_candidates.find({"test_id": test_id}).sort("created_at", -1).to_list(length=1000)
    return {"success": True, "data": [serialize_document(d) for d in docs]}


