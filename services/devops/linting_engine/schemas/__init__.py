from typing import List
from pydantic import BaseModel


class LintResponse(BaseModel):
    lint_type: str
    status: str
    errors: List[str]
    warnings: List[str]
    score: int
