from pydantic import BaseModel

class ExecuteRequest(BaseModel):
    command: str

class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
