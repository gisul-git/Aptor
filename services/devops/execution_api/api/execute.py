from fastapi import APIRouter, HTTPException
from schemas.execute import ExecuteRequest, ExecuteResponse
from core.runner import run_command

router = APIRouter(prefix="/api", tags=["execution"])

@router.post("/execute", response_model=ExecuteResponse)
def execute_command(payload: ExecuteRequest):
    try:
        result = run_command(payload.command)
        return ExecuteResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
