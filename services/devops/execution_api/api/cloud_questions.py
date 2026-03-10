from datetime import datetime
import json
import re
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

_QUESTION_DIFFICULTY_ALIASES: Dict[str, str] = {
    "beginner": "easy",
    "easy": "easy",
    "intermediate": "medium",
    "medium": "medium",
    "advanced": "hard",
    "hard": "hard",
}


def _normalize_question_difficulty(value: Any) -> str:
    return _QUESTION_DIFFICULTY_ALIASES.get(str(value or "").strip().lower(), "medium")


def _parse_years(value: Any) -> int:
    if isinstance(value, int):
        return max(0, value)
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        if match:
            return max(0, int(match.group(0)))
    return 0


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
        elif (
            "context" in q
            and "task" in q
            and "description" not in q
            and isinstance(q.get("task"), str)
        ):
            q = {
                "id": q.get("id") or f"ai-cloud-{idx + 1}",
                "title": q.get("title") or f"Cloud Question {idx + 1}",
                "description": q.get("context") or "Solve this Cloud scenario.",
                "difficulty": q.get("difficulty") or "medium",
                "kind": "command",
                "points": q.get("points") or 10,
                "starterCode": "",
                "validationMode": "content",
                "questionType": "scenario",
                "isScenarioBased": True,
                "context": q.get("context") or "",
                "task": q.get("task") or "",
                "instructions": [str(q.get("task"))],
                "constraints": [
                    "Provide a clear cloud architecture/troubleshooting explanation.",
                    "Focus on decision-making, risk, and trade-offs.",
                ],
                "hints": [
                    "Explain assumptions and constraints clearly.",
                    "Call out operational and security considerations.",
                ],
            }

        kind = str(q.get("kind") or "command").lower()
        if kind not in {"command", "terraform", "lint"}:
            kind = "command"
        difficulty = _normalize_question_difficulty(q.get("difficulty"))
        starter = q.get("starterCode")
        is_scenario = bool(
            q.get("isScenarioBased")
            or str(q.get("questionType") or q.get("question_type") or "").strip().lower() == "scenario"
        )
        if is_scenario:
            starter = starter if isinstance(starter, str) else ""
        elif not isinstance(starter, str) or not starter.strip():
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
                "questionType": str(q.get("questionType") or q.get("question_type") or ""),
                "isScenarioBased": bool(q.get("isScenarioBased")),
                "context": str(q.get("context") or ""),
                "task": str(q.get("task") or ""),
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
You generate AWS hands-on assessment tasks designed for controlled sandbox environments using LocalStack.
 
Output MUST be strictly valid JSON.

Do not include markdown.

Do not include explanations.

Do not include text outside JSON.
 
Hard Rules:

- Do not include commands.

- Do not include solution code.

- Do not include configuration solutions.

- Only generate task descriptions and step instructions.
 
All tasks must simulate realistic cloud engineering work and must be compatible with LocalStack-based sandbox validation systems.
""".strip()
 
 
    user_prompt = f"""
Act as a Senior Cloud Engineer working at a FAANG company (Google, Amazon, Meta, Apple, or Netflix).
 
Generate AWS assessment questions strictly based on the examiner's requirements.
 
Examiner Inputs
 
Role: {payload.jobRole}

Years Of Experience: {payload.yearsOfExperience}

Difficulty: {payload.difficulty}

Focus Area: {payload.focusArea}

Topics Required: {payload.topicsRequired}

Assessment Time Limit: {payload.timeLimit} minutes

Assessment Title: {payload.title}

Assessment Description: {payload.description}
 
Question Generation Priority Rule
 
The generated questions MUST follow these constraints in priority order:
 
1. topicsRequired

   Only AWS services listed in topicsRequired may be used.
 
2. difficulty

   The structural complexity must match the difficulty level.
 
3. yearsOfExperience

   The configuration depth and scenario realism must match the candidate's experience.
 
These parameters are strict constraints and must NOT be ignored.
 
Cloud Execution Environment
 
All AWS operations run locally using LocalStack.
 
Environment characteristics:
 
- Linux terminal

- AWS CLI available

- LocalStack running locally

- Internet access disabled

- No real AWS account
 
STRICT Topic Control Rule
 
Questions MUST ONLY involve AWS services listed in:
 
{payload.topicsRequired}
 
Example allowed services:
 
S3  

Lambda  

DynamoDB  

SQS  

SNS  

IAM  

CloudFormation  
 
Do NOT introduce services not listed.
 
Strict Difficulty Structure Rule
 
Easy:

- Only ONE AWS service

- Maximum 4 task steps

- Single resource creation

- Minimal configuration
 
Medium:

- One or two AWS services

- 4-6 task steps

- Resource configuration or interaction
 
Hard:

- Two or more AWS services

- 6-10 task steps

- Multi-service architecture or integration
 
Service Count Rule
 
Easy questions must use exactly ONE AWS service.
 
Medium questions may use ONE or TWO AWS services.
 
Hard questions may use TWO or more AWS services.
 
Step Count Rule
 
Easy questions -> 3-4 steps  

Medium questions -> 4-6 steps  

Hard questions -> 6-10 steps  
 
Experience Alignment Rule
 
0-1 years

- Simple resource creation tasks
 
2-3 years

- Resource configuration tasks
 
3-5 years

- Multi-step configuration tasks
 
5-7 years

- IAM configuration, event integrations
 
7+ years

- Multi-service architecture and infrastructure design
 
Experience-Difficulty Consistency Rule
 
0-2 years -> easy  

3-4 years -> easy or medium  

5+ years -> medium or hard  
 
Platform Validation Model
 
Candidate submissions are validated by analyzing:
 
- AWS CLI commands executed

- AWS resources created in LocalStack

- configuration files written

- infrastructure definitions
 
Validation Target Rule
 
Every generated question MUST produce deterministic AWS resources.
 
Examples:
 
S3

- bucket named logs-bucket
 
Lambda

- function named process-data
 
DynamoDB

- table named users-table
 
SQS

- queue named job-queue
 
IAM

- role or policy file
 
CloudFormation

- template.yaml
 
These resources must be verifiable through LocalStack.
 
Configuration Definition Rule
 
Some tasks may require configuration files such as:
 
CloudFormation templates  

IAM policy JSON files  

Lambda handler files  
 
The question must describe what configuration should be implemented but must NOT include the solution code.
 
Placeholder File Rule
 
If application code is required (for example Lambda), instruct the user to create a placeholder file.
 
Rules:
 
- File must be empty or minimal

- Filename must be explicitly specified
 
Example:
 
Create a placeholder file named `lambda_handler.py`.
 
Task Step Clarity Rules
 
Each task step MUST:
 
- Specify exact AWS resource names

- Specify file names when required

- Specify the AWS service used

- Be deterministic for automated validation
 
Examples:
 
Create an S3 bucket named `logs-storage`.
 
Create a DynamoDB table named `users-table`.
 
Create an SQS queue named `job-queue`.
 
Create a Lambda function named `process-data`.
 
Create an IAM policy file named `policy.json`.
 
Create a CloudFormation template file named `template.yaml`.
 
Generate EXACTLY {safe_count} questions.
 
Return STRICTLY this JSON format:
 
{{

  "questions": [

    {{

      "title": "",

      "company": "",

      "difficulty": "",

      "context": "",

      "task_steps": []

    }}

  ]

}}
 
Field Rules
 
title

Short AWS cloud engineering task title.
 
company

Must be one of:

Google

Amazon

Meta

Apple

Netflix
 
difficulty

Must exactly match:

{payload.difficulty}
 
context

Single paragraph describing the cloud engineering scenario.
 
task_steps

Ordered list of AWS resource setup steps including service names and resource names.
 
Important Output Rules
 
- No commands

- No solution code

- No explanations

- Only valid JSON
""".strip()

    if _parse_years(payload.yearsOfExperience) > 4:
        system_prompt = """
You generate scenario-based AWS cloud assessment questions designed for experienced engineers.
 
Output MUST be strictly valid JSON.

Do not include markdown.

Do not include explanations.

Do not include text outside JSON.
 
Hard Rules:

- Do not include commands.

- Do not include solution code.

- Do not include configuration solutions.

- Only generate meaningful scenario descriptions and task instructions.
 
All tasks must simulate realistic production cloud engineering situations.
""".strip()

        user_prompt = f"""
Act as a Senior Cloud Engineer working at a FAANG company (Google, Amazon, Meta, Apple, or Netflix).
 
Generate scenario-based AWS cloud assessment questions designed for candidates with more than 4 years of cloud experience.
 
Examiner Inputs
 
Role: {payload.jobRole}

Years Of Experience: {payload.yearsOfExperience}

Difficulty: {payload.difficulty}

Focus Area: {payload.focusArea}

Topics Required: {payload.topicsRequired}

Assessment Time Limit: {payload.timeLimit} minutes

Assessment Title: {payload.title}

Assessment Description: {payload.description}
 
Candidate Experience Requirement
 
These questions are intended for candidates with more than 4 years of experience.
 
Therefore questions must:
 
- represent real production cloud scenarios

- require engineering reasoning

- require diagnosis and architecture thinking

- avoid trivial setup tasks

- require the candidate to explain their solution approach
 
The candidate's answer will be evaluated using AI analysis of their written explanation.
 
Answer Format Requirement
 
Candidates will provide answers in natural human language.
 
The answer may include:
 
- explanation of the issue

- reasoning steps

- design decisions

- proposed solution strategy

- risks and mitigations
 
STRICT Topic Control Rule
 
Questions MUST only involve technologies listed in:
 
{payload.topicsRequired}
 
Do NOT introduce technologies not listed.
 
Difficulty Enforcement Rule
 
All generated questions must match the required difficulty level:
 
{payload.difficulty}
 
Scenario Construction Rules
 
Each question must include:
 
1. A realistic production cloud situation

2. Context about the system/environment

3. A clear problem statement

4. A request to explain how they would solve it
 
Avoid trivial tasks like:
 
- create one bucket

- create one queue

- create basic IAM role
 
Instead focus on:
 
- troubleshooting

- resilience improvements

- reliability and scalability decisions

- cost/performance trade-offs

- cloud architecture reasoning
 
Return STRICTLY this JSON format:
 
{{
  "questions": [
    {{
      "title": "",
      "company": "",
      "difficulty": "{payload.difficulty}",
      "context": "",
      "task": ""
    }}
  ]
}}
 
Important Output Rules

- No commands

- No solution code

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


