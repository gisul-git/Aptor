from enum import Enum
from pydantic import BaseModel, Field


class LintType(str, Enum):
    docker = "docker"
    kubernetes = "kubernetes"
    github_actions = "github_actions"


class LintRequest(BaseModel):
    lint_type: LintType = Field(..., description="Type of lint to perform")
    content: str = Field(..., min_length=1, description="Raw file content")
