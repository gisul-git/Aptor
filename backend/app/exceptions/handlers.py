"""Exception handlers for FastAPI."""
from __future__ import annotations

import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError, HTTPException as FastAPIHTTPException
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors with user-friendly messages."""
    logger.error(f"Validation error for {request.url.path}: {exc.errors()}")
    
    # Format errors into user-friendly messages
    error_messages = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error.get("loc", []))
        error_type = error.get("type", "")
        error_msg = error.get("msg", "")
        
        # Handle password validation errors
        if "password" in field.lower():
            if error_type == "string_too_short":
                error_messages.append("Password must be at least 8 characters long")
            elif error_type == "value_error":
                # This is from our custom password validation
                error_messages.append(error_msg)
            elif "missing" in error_type:
                error_messages.append("Password is required")
            else:
                error_messages.append(f"Password: {error_msg}")
        # Handle email validation errors
        elif "email" in field.lower():
            if "missing" in error_type:
                error_messages.append("Email is required")
            elif "value_error" in error_type or "string" in error_type:
                error_messages.append("Please enter a valid email address")
            else:
                error_messages.append(f"Email: {error_msg}")
        # Handle other field errors
        else:
            field_name = field.split(".")[-1] if "." in field else field
            if "missing" in error_type:
                error_messages.append(f"{field_name.capitalize()} is required")
            else:
                error_messages.append(f"{field_name.capitalize()}: {error_msg}")
    
    # Join all error messages into a single message
    message = "; ".join(error_messages) if error_messages else "Validation error"
    
    return JSONResponse(
        status_code=422,
        content={
            "success": False, 
            "message": message,
            "detail": message
        },
    )


async def not_found_handler(request: Request, exc: Any) -> JSONResponse:
    """Handle HTTPExceptions (404 and other status codes) - preserve original message."""
    # Check if this is an HTTPException (FastAPI or Starlette)
    if isinstance(exc, (FastAPIHTTPException, StarletteHTTPException)) or (hasattr(exc, "status_code") and hasattr(exc, "detail")):
        status_code = exc.status_code if hasattr(exc, "status_code") else 404
        detail = str(exc.detail) if hasattr(exc, "detail") and exc.detail else "Not Found"
        
        # For 404 errors, check if it's a custom message
        if status_code == 404:
            if detail and detail != "Not Found":
                return JSONResponse(
                    status_code=404,
                    content={
                        "success": False,
                        "message": detail,
                        "detail": detail,
                    },
                )
            # Default 404 - route not found
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": f"Route {request.url.path} not found",
                },
            )
        
        # For all other HTTPExceptions (403, 500, etc.), return the original error message
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "message": detail,
                "detail": detail,
            },
        )
    
    # Fallback for actual 404s (unknown routes)
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "message": f"Route {request.url.path} not found",
        },
    )


async def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Handle rate limit exceeded errors."""
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "message": "Rate limit exceeded. Please try again later.",
            "detail": str(exc.detail) if hasattr(exc, "detail") else "Too many requests"
        },
        headers={"Retry-After": str(exc.retry_after) if hasattr(exc, "retry_after") else "60"}
    )


