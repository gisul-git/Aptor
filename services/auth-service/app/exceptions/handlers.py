"""Exception handlers."""
from __future__ import annotations

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    errors = exc.errors()
    
    # Convert errors to JSON-serializable format
    # Handle any ValueError or other exception objects in the error details
    serializable_errors = []
    password_errors = []
    
    for error in errors:
        error_dict = {
            "loc": error.get("loc", []),
            "msg": error.get("msg", ""),
            "type": error.get("type", ""),
        }
        
        # Extract password validation errors
        if "password" in str(error.get("loc", [])).lower():
            msg = error.get("msg", "")
            # Convert ValueError object to string if needed
            if isinstance(msg, Exception):
                msg = str(msg)
            password_errors.append(msg)
        
        # Ensure all values are JSON-serializable
        if "ctx" in error:
            ctx = error["ctx"]
            if isinstance(ctx, dict):
                serializable_ctx = {}
                for key, value in ctx.items():
                    if isinstance(value, Exception):
                        serializable_ctx[key] = str(value)
                    else:
                        serializable_ctx[key] = value
                error_dict["ctx"] = serializable_ctx
        
        # Convert msg if it's an exception object
        if isinstance(error_dict["msg"], Exception):
            error_dict["msg"] = str(error_dict["msg"])
        
        serializable_errors.append(error_dict)
    
    # Build response message
    message = "Validation error"
    if password_errors:
        message = "Password does not meet requirements"
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": message,
            "detail": serializable_errors,
            "password_errors": password_errors,  # Separate field for easy frontend access
        },
    )


async def not_found_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle 404 errors."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "success": False,
            "message": exc.detail or "Resource not found",
        },
    )

