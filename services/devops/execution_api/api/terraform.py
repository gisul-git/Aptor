from fastapi import APIRouter, HTTPException
from schemas.terraform import TerraformRequest, TerraformResponse
from core.terraform_runner import run_terraform

router = APIRouter(prefix="/api/terraform", tags=["terraform"])

@router.post("/execute", response_model=TerraformResponse)
def execute_terraform(payload: TerraformRequest):
    try:
        result = run_terraform(payload)
        return TerraformResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
