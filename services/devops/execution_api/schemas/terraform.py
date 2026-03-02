from pydantic import BaseModel
from typing import Dict, Optional

class TerraformRequest(BaseModel):
    action: str  # init | plan | apply | destroy
    terraform_files: Dict[str, str]
    auto_approve: Optional[bool] = False

class TerraformResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
