from datetime import datetime
import json
from typing import Any, Dict, List, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Query, Request

from config.settings import get_settings
from db.mongodb import get_cloud_database
from schemas.question import DevOpsAIGenerationRequest, DevOpsQuestionCreate, DevOpsQuestionUpdate
from utils.mongo import serialize_document

router = APIRouter(prefix="/api/v1/cloud/questions", tags=["cloud-questions"])


def _normalize_doc(doc: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    serialized = serialize_document(doc)
    if serialized is None:
        return None
    serialized["id"] = serialized.get("id")
    return serialized


def _get_actor_id(request: Request) -> str:
    return request.headers.get("x-user-id") or request.headers.get("x-actor-id") or "local-dev-user"


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(text[start : end + 1])
    except Exception:
        return None


def _sanitize_generated_questions(raw: Any, count: int) -> List[Dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    safe_count = max(1, min(40, int(count)))
    out: List[Dict[str, Any]] = []
    for idx, item in enumerate(raw[:safe_count]):
        q = item if isinstance(item, dict) else {}
        if (
            "context" in q
            and "task_steps" in q
            and "description" not in q
            and isinstance(q.get("task_steps"), list)
        ):
            q = {
                "id": q.get("id") or f"ai-cloud-{idx + 1}",
                "title": q.get("title") or f"Cloud Question {idx + 1}",
                "description": q.get("context") or "Solve this Cloud task.",
                "difficulty": q.get("difficulty") or "medium",
                "kind": "command",
                "points": q.get("points") or 10,
                "starterCode": "echo \"your command\"",
                "validationMode": "hybrid",
                "instructions": [str(x) for x in q.get("task_steps", [])],
                "constraints": [
                    "Use only Linux-based, sandbox-safe operations.",
                    "Avoid real cloud provisioning and destructive operations.",
                ],
                "hints": [
                    "Start by creating a minimal working setup.",
                    "Validate each step before proceeding.",
                ],
            }

        kind = str(q.get("kind") or "command").lower()
        if kind not in {"command", "terraform", "lint"}:
            kind = "command"
        difficulty = str(q.get("difficulty") or "medium").lower()
        if difficulty not in {"easy", "medium", "hard"}:
            difficulty = "medium"
        starter = q.get("starterCode")
        if not isinstance(starter, str) or not starter.strip():
            if kind == "terraform":
                starter = 'terraform {\n  required_version = ">= 1.3.0"\n}\n'
            elif kind == "lint":
                starter = "FROM alpine:3.20\nRUN echo \"ready\"\n"
            else:
                starter = "echo \"your command\""

        out.append(
            {
                "id": str(q.get("id") or f"ai-cloud-{idx + 1}"),
                "title": str(q.get("title") or f"Cloud Question {idx + 1}"),
                "description": str(q.get("description") or "Solve this Cloud task."),
                "difficulty": difficulty,
                "points": int(q.get("points") or 10),
                "kind": kind,
                "starterCode": starter,
                "validationMode": q.get("validationMode")
                if q.get("validationMode") in {"runtime", "content", "hybrid"}
                else ("runtime" if kind == "lint" else "hybrid"),
                "lintType": q.get("lintType")
                if q.get("lintType") in {"docker", "kubernetes", "github_actions"}
                else None,
                "terraformAction": q.get("terraformAction")
                if q.get("terraformAction") in {"init", "plan", "apply", "destroy"}
                else None,
                "expectedSubmissionContains": q.get("expectedSubmissionContains")
                if isinstance(q.get("expectedSubmissionContains"), list)
                else None,
                "expectedSubmissionRegex": q.get("expectedSubmissionRegex")
                if isinstance(q.get("expectedSubmissionRegex"), str)
                else None,
                "expectedExitCode": int(q.get("expectedExitCode"))
                if isinstance(q.get("expectedExitCode"), int)
                else 0,
                "expectedStdoutRegex": q.get("expectedStdoutRegex")
                if isinstance(q.get("expectedStdoutRegex"), str)
                else None,
                "minLintScore": int(q.get("minLintScore"))
                if isinstance(q.get("minLintScore"), int)
                else None,
                "instructions": [str(x) for x in (q.get("instructions") or ["Read requirements and provide a valid solution."])],
                "constraints": [str(x) for x in (q.get("constraints") or ["Keep it executable and production-safe."])],
                "hints": [str(x) for x in (q.get("hints") or ["Start with a minimal valid solution."])],
            }
        )
    return out



@router.get("/", response_model=Dict[str, Any])
async def list_questions(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    published_only: Optional[bool] = Query(None),
) -> Dict[str, Any]:
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    query: Dict[str, Any] = {"created_by": actor_id}
    if published_only is not None:
        query["is_published"] = published_only
    docs = await db.cloud_questions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return {"success": True, "data": [_normalize_doc(d) for d in docs]}


@router.get("/published", response_model=Dict[str, Any])
async def list_published_questions(
    request: Request,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    query: Dict[str, Any] = {"created_by": actor_id}
    docs = (
        await db.cloud_published_questions.find(query)
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
    return {"success": True, "data": [_normalize_doc(d) for d in docs]}


@router.post("/", response_model=Dict[str, Any])
async def create_question(payload: DevOpsQuestionCreate, request: Request) -> Dict[str, Any]:
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    now = datetime.utcnow()
    data = payload.model_dump()
    data["created_by"] = actor_id
    data["created_at"] = now
    data["updated_at"] = now
    data["module_type"] = "cloud"
    result = await db.cloud_questions.insert_one(data)
    created = await db.cloud_questions.find_one({"_id": result.inserted_id})
    return {"success": True, "data": _normalize_doc(created)}


@router.post("/generate-ai", response_model=Dict[str, Any])
async def generate_ai_questions(payload: DevOpsAIGenerationRequest) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY in Cloud backend environment.")
    safe_count = 1
    system_prompt = """
You generate DevOps hands-on assessment tasks designed for controlled sandbox execution environments.
 
Output MUST be strictly valid JSON.

Do not include markdown.

Do not include explanations.

Do not include text outside JSON.
 
Hard Rules:

- Do not include commands.

- Do not include code snippets.

- Do not include configuration examples.

- Do not include command syntax.

- Only generate task descriptions and step instructions.
 
All tasks must simulate realistic Cloud engineering work and must be compatible with sandbox execution and static validation systems.
""".strip()
 
 
    user_prompt = f"""
Act as a Senior DevOps Engineer working at a FAANG company (Google, Amazon, Meta, Apple, or Netflix).
 
Your task is to generate DevOps assessment questions that simulate realistic internal production engineering assignments.
 
Sandbox Capabilities

The sandbox environment supports the following validation capabilities:

- Linux commands can be executed

- Shell scripts can be executed

- Docker build configuration files can be statically validated using Hadolint

- Container orchestration manifests can be statically validated

- CI workflow configuration files can be statically validated

- Infrastructure configuration files can be validated using validation tools

Sandbox Limitations

- Container runtimes cannot be executed

- Cluster environments cannot be executed

- CI workflows cannot be executed

- Internet access is not available

- No files or repositories exist initially

- The machine starts completely empty

- Execution environments do not persist state after the assessment session

Execution Environment

- Linux-based sandbox environment

- Candidates must create all files and directories manually

- Tasks must start from an empty filesystem

- Tasks must rely only on local file creation and configuration

- Tasks must not depend on external downloads

Technology Scope

The engineer may use DevOps tools available in the environment, but the generated question must NOT explicitly mention any technology names.

Technology Neutral Rule

Generated tasks must NOT explicitly mention technologies such as Docker, Kubernetes, Terraform, GitHub Actions, or similar tools.

Tasks must describe the engineering objective rather than the specific tool used to achieve it.

The engineer taking the assessment should determine which tools or commands are required to complete the task.

DevOps Scope Rules

Tasks must test DevOps skills only.

Generated tasks MUST NOT require:

- writing application code

- creating HTML pages

- writing backend services

- implementing APIs

- programming application logic

- building full software applications

Placeholder File Rule

If a task requires any application or project artifact, the engineer must create a dummy placeholder file.

The placeholder file must remain empty and must not contain any content.

These files exist only to simulate application artifacts required for DevOps operations.

Tasks must not require writing code inside these files.

Allowed Artifact Types

Tasks may require the engineer to create:

- directories and filesystem structures

- Git repositories

- container build configuration files

- orchestration configuration manifests

- CI workflow configuration files

- infrastructure configuration files

- shell scripts

- empty placeholder files

Validation Compatibility Rules

Tasks must produce artifacts that can be statically validated in the sandbox.

Container tasks

- must focus only on container build configuration files

- runtime execution is not allowed

Orchestration tasks

- must only involve creating manifest files

- deployment to clusters is not allowed

CI workflow tasks

- must only involve creating workflow configuration files

- workflows will not be executed

- if CI workflows are required, the engineer must initialize a repository first

Infrastructure configuration tasks

- must be compatible with configuration validation tools

- infrastructure must not be provisioned

Linux tasks

- may involve filesystem operations

- may involve shell scripting

- must operate entirely within the sandbox environment
 
Candidate Profile

Role: {payload.jobRole}

Experience: {payload.yearsOfExperience}

Difficulty Level: {payload.difficulty}

Focus Area: {payload.focusArea}

Topics Required: {payload.topicsRequired}

Assessment Time Limit: {payload.timeLimit} minutes

Assessment Title: {payload.title}

Assessment Description: {payload.description}
 
Task Design Requirements
 
Each generated question must:
 
- represent a realistic internal Cloud engineering assignment

- be framed as a production incident, infrastructure recovery task, or internal platform engineering request

- start from a completely empty environment

- require manual terminal-based DevOps operations

- avoid reliance on internet downloads

- produce deterministic artifacts that can be statically validated
 
Generate EXACTLY {safe_count} questions.
 
Return STRICTLY the following JSON format:
 
{{

  "questions": [

    {{

      "title": "",

      "company": "",

      "context": "",

      "task_steps": [],
    }}

  ]

}}
 
Field Rules
 
title

Short DevOps task title.
 
company

Must be one of the following:
 
Google

Amazon

Meta

Apple

Netflix
 
context

A single paragraph describing:

- the production situation

- environment conditions

- system constraints

- the final objective the engineer must achieve
 
task_steps

Ordered list of actions the engineer must perform.
 
Important Output Rules

- No commands

- No code snippets

- No configuration examples

- No explanations

- Only valid JSON
""".strip()
 
    request_body = {
        "model": settings.openai_model or "gpt-4o-mini",
        "temperature": 0.25,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }

    req = urllib_request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(request_body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    models_to_try = []
    for m in [settings.openai_model, "gpt-4.1-mini", "gpt-4o-mini"]:
        if isinstance(m, str) and m.strip() and m not in models_to_try:
            models_to_try.append(m)

    openai_errors: List[str] = []
    for model_name in models_to_try:
        try:
            request_body["model"] = model_name
            req = urllib_request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=json.dumps(request_body).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib_request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8")

            payload_json = json.loads(raw)
            content = payload_json["choices"][0]["message"]["content"]
            parsed = _extract_json_object(content if isinstance(content, str) else "")
            questions = _sanitize_generated_questions((parsed or {}).get("questions"), safe_count)
            if questions:
                return {"success": True, "model": model_name, "questions": questions}
            openai_errors.append(f"{model_name}: Model returned no usable questions.")
        except urllib_error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            openai_errors.append(f"{model_name}: HTTP {exc.code} - {detail[:400]}")
        except Exception as exc:
            openai_errors.append(f"{model_name}: {str(exc)}")

    raise HTTPException(
        status_code=502,
        detail=f"OpenAI generation failed. Tried models: {', '.join(models_to_try)}. Errors: {' | '.join(openai_errors)}",
    )


@router.get("/{question_id}", response_model=Dict[str, Any])
async def get_question(question_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    doc = await db.cloud_questions.find_one({"_id": ObjectId(question_id), "created_by": actor_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"success": True, "data": _normalize_doc(doc)}


@router.put("/{question_id}", response_model=Dict[str, Any])
async def update_question(question_id: str, payload: DevOpsQuestionUpdate, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.utcnow()
    result = await db.cloud_questions.update_one(
        {"_id": ObjectId(question_id), "created_by": actor_id},
        {"$set": updates},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    updated = await db.cloud_questions.find_one({"_id": ObjectId(question_id)})
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
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    published = is_published
    if published is None and body:
        raw = body.get("is_published")
        if isinstance(raw, bool):
            published = raw
    if published is None:
        raise HTTPException(status_code=400, detail="is_published is required")
    result = await db.cloud_questions.update_one(
        {"_id": ObjectId(question_id), "created_by": actor_id},
        {"$set": {"is_published": published, "updated_at": datetime.utcnow()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    updated = await db.cloud_questions.find_one({"_id": ObjectId(question_id)})

    if published:
        if updated:
            published_doc = {
                "question_id": str(updated.get("_id")),
                "title": updated.get("title", ""),
                "description": updated.get("description", ""),
                "difficulty": updated.get("difficulty", "medium"),
                "kind": updated.get("kind", "command"),
                "points": updated.get("points", 10),
                "ai_generated": updated.get("ai_generated", False),
                "is_published": True,
                "created_by": actor_id,
                "source_updated_at": updated.get("updated_at"),
                "published_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            await db.cloud_published_questions.update_one(
                {"question_id": str(updated.get("_id")), "created_by": actor_id},
                {"$set": published_doc},
                upsert=True,
            )
    else:
        await db.cloud_published_questions.delete_one(
            {"question_id": question_id, "created_by": actor_id}
        )

    return {"success": True, "data": _normalize_doc(updated)}


@router.delete("/{question_id}", response_model=Dict[str, Any])
async def delete_question(question_id: str, request: Request) -> Dict[str, Any]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=400, detail="Invalid question ID")
    db = get_cloud_database()
    actor_id = _get_actor_id(request)
    result = await db.cloud_questions.delete_one({"_id": ObjectId(question_id), "created_by": actor_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.cloud_published_questions.delete_one({"question_id": question_id, "created_by": actor_id})
    return {"success": True, "message": "Question deleted successfully"}


