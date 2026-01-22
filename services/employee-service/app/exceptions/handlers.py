"""Exception handlers."""
from __future__ import annotations

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    errors = exc.errors()
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "detail": errors,
        },
    )


async def not_found_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle 404 errors."""
    return JSONResponse(
        status_code=exc.status_code if hasattr(exc, 'status_code') else status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "message": exc.detail or "Resource not found",
        },
    )

