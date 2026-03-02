import os
import shutil
from fastapi import FastAPI, Header, HTTPException
from app.schemas import ExecutionRequest, ExecutionResponse
from app.executor import (
    ExecutionValidationError,
    build_aws_command,
    execute_terraform_in_nsjail,
    execute_in_nsjail,
)

app = FastAPI(title="Cloud Playground Execution Engine")
API_KEY = os.getenv("EXECUTION_API_KEY", "").strip()
AWS_BIN = shutil.which("aws")
NSJAIL_BIN = shutil.which("nsjail")
TERRAFORM_BIN = shutil.which("terraform")


def _check_api_key(x_api_key: str | None) -> None:
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    return {
        "status": "ready" if AWS_BIN and NSJAIL_BIN and TERRAFORM_BIN else "not-ready",
        "aws_installed": bool(AWS_BIN),
        "nsjail_installed": bool(NSJAIL_BIN),
        "terraform_installed": bool(TERRAFORM_BIN),
    }


@app.post("/execute", response_model=ExecutionResponse)
def execute(request: ExecutionRequest, x_api_key: str | None = Header(default=None)):
    _check_api_key(x_api_key)

    try:
        if request.mode == "terraform":
            result = execute_terraform_in_nsjail(
                session_id=request.session_id,
                terraform_code=request.terraform_code or "",
                action=request.terraform_action,
            )
        else:
            full_command = build_aws_command(
                request.command,
                request.localstack_host
            )
            result = execute_in_nsjail(full_command)

        return ExecutionResponse(
            stdout=result.stdout,
            stderr=result.stderr,
            exit_code=result.exit_code
        )

    except ExecutionValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TimeoutError as e:
        raise HTTPException(status_code=408, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
