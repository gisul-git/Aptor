"""Redis-based rate limiting middleware."""
from __future__ import annotations

import logging
from typing import Callable, Optional

from fastapi import Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from ..config.settings import get_settings

logger = logging.getLogger(__name__)

# Global limiter instance (will be initialized in main.py)
limiter: Optional[Limiter] = None


def get_user_id_from_token(request: Request) -> str:
    """
    Extract user ID from JWT token in request.
    Falls back to IP address if token not present.
    """
    try:
        # Try to get token from Authorization header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            # Decode token to get user ID
            from ..core.security import decode_token
            try:
                payload = decode_token(token)
                user_id = payload.get("sub")
                if user_id:
                    return f"user:{user_id}"
            except Exception:
                # Token invalid, fall back to IP
                pass
    except Exception:
        pass
    
    # Fall back to IP address
    return get_remote_address(request)


def get_rate_limit_key(request: Request) -> str:
    """
    Get rate limit key for request.
    Uses user ID from token if available, otherwise IP address.
    """
    return get_user_id_from_token(request)


def init_redis_limiter(redis_url: str) -> Optional[Limiter]:
    """
    Initialize Redis-based rate limiter.
    
    Args:
        redis_url: Redis connection URL (e.g., redis://localhost:6379/0)
    
    Returns:
        Limiter instance or None if initialization fails
    """
    global limiter
    try:
        # slowapi supports Redis via limits library
        # Format: redis://localhost:6379/0
        limiter = Limiter(
            key_func=get_rate_limit_key,
            storage_uri=redis_url,
            default_limits=["1000/hour"]  # Global fallback limit
        )
        logger.info(f"Redis rate limiter initialized successfully with URL: {redis_url}")
        return limiter
    except Exception as e:
        logger.warning(f"Redis rate limiter initialization failed: {e}. Rate limiting will be disabled.")
        logger.warning("This is not critical - the app will continue to work without rate limiting.")
        limiter = None
        return None


def get_limiter() -> Optional[Limiter]:
    """Get the global limiter instance."""
    return limiter


# Rate limit decorators for specific endpoints
def rate_limit_auth() -> Callable:
    """Rate limit for authentication endpoints: 5 requests/min/user"""
    def decorator(func):
        if limiter:
            return limiter.limit("5/minute")(func)
        return func
    return decorator


def rate_limit_ai_generation() -> Callable:
    """Rate limit for AI generation endpoints: 3 requests/min/user"""
    def decorator(func):
        if limiter:
            return limiter.limit("3/minute")(func)
        return func
    return decorator


def rate_limit_judge0() -> Callable:
    """Rate limit for Judge0 code execution: 10 requests/min/user"""
    def decorator(func):
        if limiter:
            return limiter.limit("10/minute")(func)
        return func
    return decorator


def rate_limit_webrtc() -> Callable:
    """Rate limit for WebRTC signaling: 30 requests/min/user"""
    def decorator(func):
        if limiter:
            return limiter.limit("30/minute")(func)
        return func
    return decorator


