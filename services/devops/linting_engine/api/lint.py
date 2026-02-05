from fastapi import APIRouter
from linting_engine.schemas.request import LintRequest
from linting_engine.schemas.response import LintResponse
from linting_engine.core.dispatcher import dispatch_lint

router = APIRouter(prefix="/api/devops", tags=["DevOps Linting"])


@router.post("/lint", response_model=LintResponse)
def lint_devops_config(request: LintRequest):
    result = dispatch_lint(request.lint_type, request.content)

    return LintResponse(
        lint_type=request.lint_type.value,
        status=result["status"],
        errors=result["errors"],
        warnings=result["warnings"],
        score=result["score"],
    )
