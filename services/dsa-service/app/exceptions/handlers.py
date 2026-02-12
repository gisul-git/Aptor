from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"success": False, "message": "Validation error", "detail": exc.errors()},
    )

async def not_found_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """
    Generic HTTPException handler.

    IMPORTANT:
    - Preserve the original status_code from the exception (401, 403, 404, etc.)
    - Only default to 404 when status_code is missing.
    """
    status_code = getattr(exc, "status_code", status.HTTP_404_NOT_FOUND) or status.HTTP_404_NOT_FOUND
    message = exc.detail or "Resource not found"

    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message},
    )

