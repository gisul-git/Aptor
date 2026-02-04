"""Exception handlers."""
from __future__ import annotations
import logging

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation errors."""
    errors = exc.errors()
    
    # Log the raw errors structure to identify the issue
    logger.error("🔴 [Exception Handler] Validation error occurred")
    logger.error(f"🔴 [Exception Handler] Raw errors type: {type(errors)}")
    logger.error(f"🔴 [Exception Handler] Raw errors: {errors}")
    logger.error(f"🔴 [Exception Handler] Raw errors repr: {repr(errors)}")
    
    # Clean errors to ensure JSON serializability
    # Convert any non-serializable objects (like ValueError) to strings
    cleaned_errors = []
    for error in errors:
        if isinstance(error, dict):
            cleaned_error = error.copy()
            # Handle ctx field which may contain non-serializable objects
            if 'ctx' in cleaned_error and isinstance(cleaned_error['ctx'], dict):
                cleaned_ctx = cleaned_error['ctx'].copy()
                # Convert ValueError or other exception objects to strings
                if 'error' in cleaned_ctx:
                    error_obj = cleaned_ctx['error']
                    if isinstance(error_obj, Exception):
                        # Convert exception to string message
                        cleaned_ctx['error'] = str(error_obj)
                    elif not isinstance(error_obj, (str, int, float, bool, type(None))):
                        # Convert any other non-serializable object to string
                        cleaned_ctx['error'] = str(error_obj)
                cleaned_error['ctx'] = cleaned_ctx
            cleaned_errors.append(cleaned_error)
        else:
            cleaned_errors.append(error)
    
    # Log each error in detail
    for idx, error in enumerate(cleaned_errors):
        logger.error(f"🔴 [Exception Handler] Error {idx}: {error}")
        logger.error(f"🔴 [Exception Handler] Error {idx} type: {type(error)}")
        logger.error(f"🔴 [Exception Handler] Error {idx} keys: {error.keys() if isinstance(error, dict) else 'Not a dict'}")
        
        # Check if ctx exists and what's in it
        if isinstance(error, dict) and 'ctx' in error:
            logger.error(f"🔴 [Exception Handler] Error {idx} ctx: {error['ctx']}")
            logger.error(f"🔴 [Exception Handler] Error {idx} ctx type: {type(error['ctx'])}")
            if isinstance(error['ctx'], dict):
                logger.error(f"🔴 [Exception Handler] Error {idx} ctx keys: {error['ctx'].keys()}")
                if 'error' in error['ctx']:
                    logger.error(f"🔴 [Exception Handler] Error {idx} ctx['error']: {error['ctx']['error']}")
                    logger.error(f"🔴 [Exception Handler] Error {idx} ctx['error'] type: {type(error['ctx']['error'])}")
                    logger.error(f"🔴 [Exception Handler] Error {idx} ctx['error'] repr: {repr(error['ctx']['error'])}")
    
    # Try to serialize errors to see what fails
    try:
        import json
        test_serialize = json.dumps(cleaned_errors)
        logger.error(f"🔴 [Exception Handler] Errors are JSON serializable: {test_serialize}")
    except Exception as e:
        logger.error(f"🔴 [Exception Handler] JSON serialization failed: {type(e).__name__}: {e}")
        logger.error(f"🔴 [Exception Handler] JSON serialization error details: {repr(e)}")
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "message": "Validation error",
            "detail": cleaned_errors,
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

