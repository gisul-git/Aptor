import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import DSA_EXECUTION_API_URL
from ..services.dsa_execution_service import (
    execute_dsa_single,
    is_dsa_language,
    DSAExecutionError,
)

router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])
logger = logging.getLogger("backend")


class RunCodeRequest(BaseModel):
    source_code: str
    language: str  # e.g. "python", "java", "cpp"
    input_data: str = ""
    function_name: str = ""


@router.post("/run")
async def run_code(request: RunCodeRequest):
    """
    Execute code with test input (doesn't save submission).
    Uses the DSA execution API; only the 10 DSA languages are supported.
    language: name e.g. python, java, cpp, javascript, typescript, c, go, rust, kotlin, csharp.
    """
    logger.info("Received request for /run")
    logger.info("Using DSA execution API: %s", DSA_EXECUTION_API_URL)

    if not is_dsa_language(request.language):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {request.language}. Use one of: python, c, cpp, java, go, rust, javascript, typescript, kotlin, csharp.",
        )
    if not (request.function_name or "").strip():
        raise HTTPException(
            status_code=400,
            detail="function_name is required for DSA execution.",
        )

    try:
        logger.info("Sending request to DSA execution API...")
        result = await execute_dsa_single(
            source_code=request.source_code,
            language=request.language,
            function_name=request.function_name.strip(),
            input_data=request.input_data or "",
            expected_output=None,
        )
        logger.info("DSA execution API response: %s", result)
        return result
    except DSAExecutionError as e:
        logger.error("DSA execution error on /run: %s", e, exc_info=True)
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error("Error executing /run: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
