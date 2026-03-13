from datetime import datetime
import json
import re
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

_DIFFICULTY_ALIASES: Dict[str, str] = {
    "beginner": "beginner",
    "easy": "beginner",
    "intermediate": "intermediate",
    "medium": "intermediate",
    "advanced": "advanced",
    "hard": "advanced",
}

_QUESTION_DIFFICULTY_ALIASES: Dict[str, str] = {
    "beginner": "easy",
    "easy": "easy",
    "intermediate": "medium",
    "medium": "medium",
    "advanced": "hard",
    "hard": "hard",
}

_SUGGESTED_TOPICS_BY_BAND: Dict[str, Dict[str, List[str]]] = {
    "0-1": {
        "beginner": [
            "Linux file permissions and ownership basics",
            "Directory structure setup for service deployment",
            "Basic shell script for log rotation",
            "Git repository initialization and commit hygiene",
            "Simple container build file with minimal layers",
        ],
        "intermediate": [
            "Basic CI pipeline stages for lint and validate",
            "Service configuration file organization by environment",
            "Container image tagging strategy for test and prod",
            "YAML manifest structure for single-service deployment",
            "Basic rollback checklist automation script",
        ],
        "advanced": [
            "Secure secret reference patterns in configuration",
            "Multi-step pre-deployment validation workflow",
            "Artifact naming conventions for release traceability",
            "Config drift detection workflow definition",
            "Dependency pinning strategy for stable builds",
        ],
    },
    "2-3": {
        "beginner": [
            "Linux user and group strategy for app runtime",
            "Shell script to validate required file structure",
            "Git branching model for release candidates",
            "Container build context cleanup and ignore rules",
            "Basic service health check config documentation",
        ],
        "intermediate": [
            "CI workflow with branch-based quality gates",
            "Container build optimization with cached layers",
            "Deployment manifest split by base and overlays",
            "Infrastructure validation workflow for change review",
            "Automated config syntax checks in pipeline",
        ],
        "advanced": [
            "Release pipeline with staged promotion rules",
            "Configuration policy checks before publish",
            "Immutable artifact versioning with metadata labels",
            "Cross-environment variable inheritance strategy",
            "Disaster recovery runbook as executable checklist",
        ],
    },
    "4-6": {
        "beginner": [
            "Reusable shell utility library for repo tasks",
            "Git hooks policy for commit message standards",
            "Base image hardening checklist for containers",
            "Environment-specific config file naming rules",
            "Artifact retention policy definition",
        ],
        "intermediate": [
            "Multi-service repository layout for platform teams",
            "CI matrix strategy for environment validation",
            "Deployment manifest templating conventions",
            "State file structure design for infra config",
            "Automated release notes generation from tags",
        ],
        "advanced": [
            "Progressive delivery configuration with safety gates",
            "Pipeline approval workflow for regulated changes",
            "Infrastructure module version governance",
            "Cross-service dependency rollout sequencing",
            "Incident-response automation for failed deployments",
        ],
    },
    "7-10": {
        "beginner": [
            "Platform bootstrap checklist for new repositories",
            "Standardized logging directory and retention schema",
            "Access control naming conventions for teams",
            "Baseline container policy enforcement checklist",
            "Repository compliance metadata structure",
        ],
        "intermediate": [
            "Organization-wide CI template architecture",
            "Shared deployment manifest library strategy",
            "Environment promotion governance workflow",
            "Infrastructure validation guardrails per workspace",
            "Golden path onboarding automation for services",
        ],
        "advanced": [
            "Multi-region failover configuration strategy",
            "Policy-as-code gate design for platform security",
            "Release orchestration across dependent services",
            "Drift remediation workflow with approval controls",
            "SLO-driven deployment risk scoring model",
        ],
    },
    "11-15": {
        "beginner": [
            "Enterprise naming standards for infra artifacts",
            "Global repository baseline template design",
            "Operational readiness checklist for new services",
            "Cross-team config ownership documentation model",
            "Static validation standards for platform repos",
        ],
        "intermediate": [
            "Federated CI governance for multiple business units",
            "Shared policy bundle lifecycle management",
            "Multi-tenant deployment configuration standards",
            "Platform-wide environment drift reporting workflow",
            "Compliance evidence generation from pipeline metadata",
        ],
        "advanced": [
            "Resilience architecture playbooks for critical systems",
            "Global release governance with risk-tier routing",
            "Zero-trust configuration strategy for platform pipelines",
            "Infrastructure abstraction model for multi-cloud parity",
            "Executive-level incident containment automation design",
        ],
    },
}


def _normalize_difficulty(value: str) -> str:
    return _DIFFICULTY_ALIASES.get(str(value or "").strip().lower(), "intermediate")


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


def _experience_band(years: int) -> str:
    if years <= 1:
        return "0-1"
    if years <= 3:
        return "2-3"
    if years <= 6:
        return "4-6"
    if years <= 10:
        return "7-10"
    return "11-15"


def _get_suggested_topics(years: Any, difficulty: str) -> List[str]:
    band = _experience_band(_parse_years(years))
    normalized_difficulty = _normalize_difficulty(difficulty)
    topics = _SUGGESTED_TOPICS_BY_BAND.get(band, {}).get(normalized_difficulty, [])
    return topics[:5]


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
                "id": q.get("id") or f"ai-devops-{idx + 1}",
                "title": q.get("title") or f"DevOps Question {idx + 1}",
                "description": q.get("context") or "Solve this DevOps task.",
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
                "id": q.get("id") or f"ai-devops-{idx + 1}",
                "title": q.get("title") or f"DevOps Question {idx + 1}",
                "description": q.get("context") or "Solve this DevOps scenario.",
                "difficulty": q.get("difficulty") or "medium",
                "kind": "command",
                "points": q.get("points") or 10,
                "starterCode": "",
                "validationMode": "content",
                "instructions": [str(q.get("task"))],
                "constraints": [
                    "Provide a clear, production-oriented explanation.",
                    "Focus on diagnosis, reasoning, and solution approach.",
                ],
                "hints": [
                    "Explain assumptions and trade-offs.",
                    "Describe risks and mitigation steps.",
                ],
            }

        kind = str(q.get("kind") or "command").lower()
        if kind not in {"command", "terraform", "lint"}:
            kind = "command"
        difficulty = _normalize_question_difficulty(q.get("difficulty"))
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


@router.get("/suggested-topics", response_model=Dict[str, Any])
async def get_suggested_topics(
    years_of_experience: int = Query(0, ge=0, le=50),
    difficulty: str = Query("intermediate"),
) -> Dict[str, Any]:
    normalized_difficulty = _normalize_difficulty(difficulty)
    band = _experience_band(years_of_experience)
    topics = _get_suggested_topics(years_of_experience, normalized_difficulty)
    return {
        "success": True,
        "data": {
            "yearsOfExperience": years_of_experience,
            "experienceBand": band,
            "difficulty": normalized_difficulty,
            "topics": topics,
        },
    }


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
    safe_count = 1
    fallback_topics = _get_suggested_topics(payload.yearsOfExperience, payload.difficulty)
    effective_topics_required = (payload.topicsRequired or "").strip() or ", ".join(fallback_topics)
    requested_category = str(getattr(payload, "questionCategory", "") or "").strip().lower()
    if requested_category not in {"coding", "scenario"}:
        requested_category = "scenario" if _parse_years(payload.yearsOfExperience) > 4 else "coding"

    system_prompt = """
You generate DevOps hands-on assessment tasks designed for controlled sandbox environments.
 
Output MUST be strictly valid JSON.

Do not include markdown.

Do not include explanations.

Do not include text outside JSON.
 
Hard Rules:

- Do not include commands.

- Do not include solution code.

- Do not include configuration solutions.

- Only generate task descriptions and step instructions.
 
All tasks must simulate realistic DevOps engineering work and must be compatible with sandbox validation systems.
""".strip()
 
 
    user_prompt = f"""
Act as a Senior DevOps Engineer working at a FAANG company (Google, Amazon, Meta, Apple, or Netflix).
 
Generate DevOps assessment questions strictly based on the examiner's requirements.
 
Examiner Inputs
 
Role: {payload.jobRole}

Experience: {payload.yearsOfExperience}

Difficulty: {payload.difficulty}

Focus Area: {payload.focusArea}

Topics Required: {effective_topics_required}

Assessment Time Limit: {payload.timeLimit} minutes

Assessment Title: {payload.title}

Assessment Description: {payload.description}
 
STRICT Topic Control Rule
 
Questions MUST ONLY use technologies listed in:
 
{effective_topics_required}
 
Do NOT introduce technologies that are not listed.
 
Example:
 
If topicsRequired = ["Docker"]
 
Allowed:

- Dockerfile

- Container build configuration
 
Not Allowed:

- Kubernetes

- Terraform

- GitHub Actions
 
Difficulty Enforcement Rule
 
All generated questions MUST match the required difficulty level:
 
{payload.difficulty}
 
Easy

- Simple tasks

- Few files

- Single technology
 
Medium

- Multiple files

- Multi-step configuration

- May combine two technologies
 
Hard

- Complex repository structure

- Advanced configuration

- Multiple technologies
 
Experience Control Rule
 
The complexity of the generated questions MUST match the candidate's years of experience.
 
0-1 years

- Very basic tasks

- Simple Linux or Git operations

- Minimal configuration files
 
2-3 years

- Basic Dockerfile or CI workflow tasks

- Small repository structures
 
3-5 years

- Multi-step configuration tasks

- Docker + Kubernetes or Docker + CI

- Multiple configuration files
 
5-7 years

- Advanced DevOps tasks

- Multi-stage Docker builds

- CI pipeline configuration

- Infrastructure configuration using Terraform
 
7+ years

- Complex DevOps repository architecture

- Multi-technology tasks combining Docker, Kubernetes, CI, and Terraform

- Production-style configuration design
 
Experience-Difficulty Consistency Rule
 
Ensure difficulty aligns with years of experience:
 
0-2 years -> easy  

3-4 years -> easy or medium  

5+ years -> medium or hard  
 
Platform Execution Model
 
The platform does NOT execute infrastructure or services.
 
Candidate submissions are validated by analyzing:
 
- commands written

- files created

- directory structure

- configuration content written inside files
 
Environment Model
 
- Linux-based sandbox environment

- The environment starts completely empty

- No files, directories, or repositories exist initially

- Candidates must create everything manually using terminal commands

- Internet access is disabled
 
Infrastructure Restrictions
 
- No cloud provisioning

- No external downloads

- No runtime deployment validation

- Docker, Kubernetes, CI workflows, and Terraform configurations are validated statically only
 
Validation Target Rule
 
Every generated question MUST produce deterministic artifacts that can be validated automatically by the platform.
 
Examples of validation artifacts:
 
Docker tasks

- Dockerfile
 
Kubernetes tasks

- deployment.yaml

- service.yaml
 
CI tasks

- .github/workflows/ci.yml
 
Terraform tasks

- main.tf

- provider.tf
 
Linux tasks

- directories or files
 
Each question MUST include steps that result in creation of these artifacts.
 
Configuration Definition Rule
 
Tasks may require the candidate to write configuration content inside files.
 
Examples include:
 
Dockerfile instructions

Kubernetes YAML definitions

GitHub Actions workflow steps

Terraform resource definitions
 
The question must describe what configuration should be implemented but must NOT include the solution code.
 
Placeholder File Rule
 
If an application artifact is required, instruct the user to create a dummy placeholder file.
 
Rules:
 
- The file must be empty

- The file name must be explicitly mentioned
 
Example:
 
Create an empty placeholder file named `index.html`.
 
Task Step Clarity Rules
 
Each task step MUST:
 
- Specify exact directory names

- Specify exact file names

- Specify the technology used

- Be deterministic for automated validation
 
Examples of valid steps:
 
Create a Git repository in the project directory.
 
Create a Dockerfile in the repository root.
 
Define container build instructions inside the Dockerfile.
 
Create a directory named `manifests` for Kubernetes YAML files.
 
Create a Kubernetes Deployment manifest named `deployment.yaml`.
 
Create a GitHub Actions workflow file named `ci.yml` inside `.github/workflows`.
 
Create Terraform configuration files named `main.tf` and `provider.tf`.
 
Generate EXACTLY {safe_count} questions.
 
Return STRICTLY this JSON format:
 
{{

  "questions": [

    {{

      "title": "",

      "company": "",

      "difficulty": "easy | medium | hard",

      "context": "",

      "task_steps": []

    }}

  ]

}}
 
Field Rules
 
title

Short DevOps task title.
 
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

Single paragraph describing the engineering scenario and the configuration objective.
 
task_steps

Ordered list of clear DevOps actions including technologies and file names.
 
Important Output Rules

- No commands

- No solution code

- No explanations

- Only valid JSON
""".strip()

    if requested_category == "scenario":
        system_prompt = """
You generate scenario-based DevOps assessment questions designed for experienced engineers.
 
Output MUST be strictly valid JSON.

Do not include markdown.

Do not include explanations.

Do not include text outside JSON.
 
Hard Rules:

- Do not include commands.

- Do not include solution code.

- Do not include configuration solutions.

- Only generate meaningful scenario descriptions and task instructions.
 
All tasks must simulate realistic production engineering situations faced by senior DevOps engineers.
""".strip()

        user_prompt = f"""
Act as a Senior DevOps Engineer working at a FAANG company (Google, Amazon, Meta, Apple, or Netflix).
 
Generate scenario-based DevOps assessment questions.
 
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
 
These questions are intended for scenario-style evaluation where candidates explain reasoning and solution approach.
 
Therefore questions must:
 
- represent real production scenarios

- require engineering reasoning

- require problem diagnosis or architecture thinking

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

- potential risks or improvements
 
The question must therefore be clear, realistic, and meaningful.
 
STRICT Topic Control Rule
 
Questions MUST only involve technologies listed in:
 
{payload.topicsRequired}
 
Do NOT introduce technologies not listed.
 
Example:
 
If topicsRequired = ["Docker"]
 
Allowed:

- container image optimization

- container build pipeline issues

- runtime container troubleshooting
 
Not allowed:

- Kubernetes

- Terraform

- AWS services
 
Difficulty Enforcement Rule
 
All generated questions must match the required difficulty level:
 
{payload.difficulty}
 
Easy

- focused troubleshooting or explanation

- one technology
 
Medium

- multi-step reasoning

- interaction between components
 
Hard

- complex production scenario

- architecture-level reasoning

- performance, reliability, or scalability considerations
 
Experience Alignment Rule
 
Since candidates have more than 4 years of experience, questions must include:
 
- real production situations

- incident analysis

- system design thinking

- operational decision making
 
Examples of valid scenarios:
 
- CI/CD pipeline failures

- container build performance issues

- infrastructure misconfiguration

- production deployment problems

- scaling or reliability concerns
 
Scenario Construction Rules
 
Each question must include:
 
1. A realistic production situation

2. Context about the system or environment

3. A clear problem statement

4. A request for the candidate to explain how they would solve it
 
The scenario should sound like a real internal engineering request.
 
Example style (do NOT reuse this example):
 
"A service deployment pipeline recently started failing after a change to the container build process..."
 
Avoid trivial tasks like:
 
- create a Dockerfile

- create a Kubernetes manifest

- initialize a Git repository
 
Instead focus on:
 
- troubleshooting

- architecture improvement

- reliability fixes

- DevOps workflow design
 
Question Structure Rules
 
Each question must contain:
 
title  

Short DevOps scenario title.
 
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

A detailed paragraph describing the production scenario.
 
task  

A clear question asking the candidate to explain their approach or solution.
 
Important Output Rules
 
- No commands

- No configuration code

- No solutions

- Only scenario descriptions

- Only valid JSON
 
Return STRICTLY this JSON format:
 
{{

  "questions": [

    {{

      "title": "",

      "company": "",

      "difficulty": "",

      "context": "",

      "task": ""

    }}

  ]

}}
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
            if questions and requested_category == "scenario":
                normalized: List[Dict[str, Any]] = []
                for q in questions:
                    qq = dict(q)
                    qq["kind"] = "command"
                    qq["validationMode"] = "content"
                    qq["starterCode"] = ""
                    constraints = qq.get("constraints")
                    if not isinstance(constraints, list) or not constraints:
                        qq["constraints"] = [
                            "Provide a clear, production-oriented explanation.",
                            "Focus on diagnosis, reasoning, and solution approach.",
                        ]
                    hints = qq.get("hints")
                    if not isinstance(hints, list) or not hints:
                        qq["hints"] = [
                            "Explain assumptions and trade-offs.",
                            "Describe risks and mitigation steps.",
                        ]
                    normalized.append(qq)
                questions = normalized
            elif questions and requested_category == "coding":
                normalized = []
                for q in questions:
                    qq = dict(q)
                    if str(qq.get("validationMode") or "").lower() == "content":
                        qq["validationMode"] = "hybrid"
                    if str(qq.get("kind") or "").lower() == "command":
                        starter = qq.get("starterCode")
                        if not isinstance(starter, str) or not starter.strip():
                            qq["starterCode"] = 'echo "your command"'
                    normalized.append(qq)
                questions = normalized
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
