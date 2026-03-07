from datetime import datetime
import json
from typing import Any, Dict, List, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request

from bson import ObjectId
from fastapi import APIRouter, Body, HTTPException, Query, Request

from config.settings import get_settings
from db.mongodb import get_database
from schemas.question import DevOpsAIGenerationRequest, DevOpsQuestionCreate, DevOpsQuestionUpdate
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
                "id": str(q.get("id") or f"ai-devops-{idx + 1}"),
                "title": str(q.get("title") or f"DevOps Question {idx + 1}"),
                "description": str(q.get("description") or "Solve this DevOps task."),
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
    db = get_database()
    actor_id = _get_actor_id(request)
    query: Dict[str, Any] = {"created_by": actor_id}
    if published_only is not None:
        query["is_published"] = published_only
    docs = await db.devops_questions.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return {"success": True, "data": [_normalize_doc(d) for d in docs]}


@router.get("/published", response_model=Dict[str, Any])
async def list_published_questions(
    request: Request,
    skip: int = 0,
    limit: int = 100,
) -> Dict[str, Any]:
    db = get_database()
    actor_id = _get_actor_id(request)
    query: Dict[str, Any] = {"created_by": actor_id}
    docs = (
        await db.devops_published_questions.find(query)
        .sort("published_at", -1)
        .skip(skip)
        .limit(limit)
        .to_list(length=limit)
    )
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


@router.post("/generate-ai", response_model=Dict[str, Any])
async def generate_ai_questions(payload: DevOpsAIGenerationRequest) -> Dict[str, Any]:
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="Missing OPENAI_API_KEY in DevOps backend environment.")
    safe_count = max(1, min(40, int(payload.questionCount or 1)))
    system_prompt = """
You are a Senior DevOps Engineer at Gisul and you generate hands-on, production-style DevOps assessment questions.

Rules:
1) Return ONLY valid JSON.
2) Use practical command-based tasks.
3) The environment starts empty; candidates create files/configs from scratch.
4) Do not include exact command answers; provide intent-oriented guidance.
5) Ensure realism, clarity, solvability, and difficulty-fit.
""".strip()

    user_prompt = f"""
Generate EXACTLY {safe_count} DevOps questions using this Gisul reference style as the baseline:

REFERENCE CHALLENGE:
{{
  "title": "Containerize and Deploy the Gisul Inventory Service",
  "company": "Gisul",
  "scenario": "The Gisul engineering team has developed a lightweight Inventory API used by internal services to track product availability. The backend developers have delivered the application code but forgot to prepare a containerized deployment environment. As a DevOps engineer, you are responsible for preparing the project structure, containerizing the application, and deploying it so that the QA team can begin testing.",
  "description": "The Inventory API must run inside a Docker container so that it can later be deployed to the company's Kubernetes platform. Currently, the system environment is completely empty and no project files exist. You must create the application files, configure a Docker build process, build a container image, and run the service locally with proper port mapping. The platform will only evaluate the commands written by the user to ensure the correct DevOps workflow is followed.",
  "environment": "The environment is a clean Linux terminal with no existing files or directories. No project repository or configuration files exist. The following tools are installed and available: Linux shell utilities, Docker CLI, Git, Kubernetes CLI, Terraform CLI, and AWS CLI. The user must create all required directories, files, and configurations from scratch using terminal commands.",
  "objective": "Prepare a containerized environment for the Gisul Inventory API by creating the application structure, defining a Docker build configuration, building the container image, and deploying the service locally using Docker with proper port exposure.",
  "task_steps": [
    "Create a new project directory named 'gisul-inventory-service' and navigate into it.",
    "Initialize a Git repository inside the project directory to track project changes.",
    "Create the application structure required for a small Node.js service including an application file and dependency configuration file.",
    "Write a simple server application that listens on a defined port and returns a message confirming the Inventory API is running.",
    "Create a Dockerfile that defines how the application should be containerized using a suitable base image.",
    "Configure the Dockerfile to copy application files, install dependencies, expose the correct application port, and start the service.",
    "Build a Docker image for the Inventory service using an appropriate image name and version tag.",
    "Run a container from the created image with a specific container name and port mapping between the host and container.",
    "Verify that the container is running and that the service is accessible from the host system."
  ],
  "expected_commands": [
    "Linux filesystem operations to create directories and navigate project structure",
    "Commands to initialize a Git repository",
    "Commands used to create and edit files directly from the terminal",
    "Docker image build operations using a Dockerfile",
    "Docker container execution with custom container naming",
    "Port mapping configuration between host and container",
    "Commands used to inspect running containers and verify container status",
    "Network verification operations to confirm the service is reachable"
  ],
  "validation": "The platform validates that the user performs the correct sequence of DevOps operations. It checks whether the user creates the required project directory, initializes version control, generates application and configuration files, builds a container image, runs a container with correct naming and port mapping, and performs commands that confirm the container is active.",
  "difficulty": "Intermediate",
  "tags": ["Linux", "Docker", "Git", "Containerization", "DevOps"]
}}

Candidate profile:
- Role: {payload.jobRole}
- Experience: {payload.yearsOfExperience}
- Difficulty: {payload.difficulty}
- Focus: {payload.focusArea}
- Topics: {payload.topicsRequired}
- Time limit: {payload.timeLimit} minutes total
- Assessment title: {payload.title}
- Assessment description: {payload.description}

Return ONLY this schema:
{{
  "questions": [
    {{
      "id": "string",
      "title": "string",
      "description": "string",
      "difficulty": "easy|medium|hard",
      "points": number,
      "kind": "command|terraform|lint",
      "starterCode": "string",
      "validationMode": "runtime|content|hybrid",
      "lintType": "docker|kubernetes|github_actions (optional)",
      "terraformAction": "init|plan|apply|destroy (optional)",
      "expectedSubmissionContains": ["string"] (optional),
      "expectedSubmissionRegex": "string (optional)",
      "expectedExitCode": number (optional),
      "expectedStdoutRegex": "string (optional)",
      "minLintScore": number (optional),
      "instructions": ["string","string","string"],
      "constraints": ["string","string"],
      "hints": ["string","string"]
    }}
  ]
}}

Ensure command-intent guidance only; do not reveal exact commands.
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
            await db.devops_published_questions.update_one(
                {"question_id": str(updated.get("_id")), "created_by": actor_id},
                {"$set": published_doc},
                upsert=True,
            )
    else:
        await db.devops_published_questions.delete_one(
            {"question_id": question_id, "created_by": actor_id}
        )

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
    await db.devops_published_questions.delete_one({"question_id": question_id, "created_by": actor_id})
    return {"success": True, "message": "Question deleted successfully"}

