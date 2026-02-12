import logging
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..config import JUDGE0_URL
from ..utils.judge0 import submit_to_judge0

router = APIRouter(prefix="/api/v1/dsa", tags=["dsa"])
logger = logging.getLogger("backend")


class RunCodeRequest(BaseModel):
    source_code: str
    language_id: int
    input_data: str = ""


@router.post("/run")
async def run_code(request: RunCodeRequest):
    """
    Execute code with test input (doesn't save submission)
    Returns raw Judge0 result with stdout, stderr, compile_output, status, etc.
    No auth required.
    """
    logger.info("Received request for /run")
    payload = request.model_dump()
    logger.info(f"Input payload: {payload}")
    logger.info(f"Using Judge0 URL: {JUDGE0_URL}")

    try:
        logger.info("Sending request to Judge0...")
        result = await submit_to_judge0(
            source_code=request.source_code,
            language_id=request.language_id,
            stdin=request.input_data
        )
        logger.info(f"Judge0 response: {result}")
        return result
    except Exception as e:
        logger.error(f"Error executing /run: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

