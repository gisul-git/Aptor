from typing import Literal
from pydantic import BaseModel, Field


class ExecutionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    command: str = Field(default="", max_length=512)
    localstack_host: str = Field(default="localstack", min_length=1, max_length=255)
    mode: Literal["aws", "terraform"] = "aws"
    terraform_code: str | None = Field(default=None, max_length=20000)
    terraform_action: Literal["init", "plan", "apply", "destroy", "validate"] = "plan"


class ExecutionResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
