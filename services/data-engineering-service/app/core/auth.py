"""
Authentication and authorization utilities.
"""

import structlog
from typing import Optional, Dict, Any
from fastapi import HTTPException, Security, Depends, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timedelta
import hashlib
import hmac

from app.core.config import settings

logger = structlog.get_logger()

# Security scheme
security = HTTPBearer(auto_error=False)

# Simple rate limiter for testing
class SimpleRateLimiter:
    def __init__(self):
        self.requests = {}
    
    async def is_allowed(self, key: str, limit: int = 100, window: int = 3600) -> bool:
        """Simple rate limiting check."""
        now = datetime.utcnow().timestamp()
        if key not in self.requests:
            self.requests[key] = []
        
        # Clean old requests
        self.requests[key] = [req_time for req_time in self.requests[key] if now - req_time < window]
        
        # Check limit
        if len(self.requests[key]) >= limit:
            return False
        
        # Add current request
        self.requests[key].append(now)
        return True

rate_limiter = SimpleRateLimiter()


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a simple token (for testing)."""
    try:
        # Simple token verification for testing
        # In production, this would use proper JWT verification
        if token.startswith("test-token-"):
            user_id = token.replace("test-token-", "")
            return {
                "sub": user_id,
                "email": f"{user_id}@example.com",
                "experience_level": 5,
                "role": "admin" if user_id == "admin-user" else "user"
            }
        return None
    except Exception as e:
        logger.warning("Token verification failed", error=str(e))
        return None


async def get_current_user_id(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
) -> str:
    """Get current user ID from gateway-injected header."""
    if not x_user_id:
        raise HTTPException(
            status_code=401,
            detail="User ID not found in request headers. Authentication required."
        )
    return x_user_id


async def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_org_id: Optional[str] = Header(None, alias="X-Org-Id"),
    x_role: Optional[str] = Header(None, alias="X-Role")
) -> Optional[Dict[str, Any]]:
    """Get current user from gateway headers (optional - returns None if not authenticated)."""
    if not x_user_id:
        return None
    
    return {
        "user_id": x_user_id,
        "id": x_user_id,
        "_id": x_user_id,
        "org_id": x_org_id,
        "role": x_role or "user"
    }


async def get_current_user_required(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> Dict[str, Any]:
    """Get current user from token (required authentication)."""
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = credentials.credentials
    payload = verify_token(token)
    
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "experience_level": payload.get("experience_level", 0),
        "preferences": payload.get("preferences", {}),
        "role": payload.get("role", "user")
    }


async def get_admin_user(
    current_user: Dict[str, Any] = Depends(get_current_user_required)
) -> Dict[str, Any]:
    """Get current user and verify admin role."""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    return current_user


# Rate limiting decorator
def rate_limit(limit: int = 100, window: int = 3600):
    """Rate limiting decorator."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # For testing, we'll skip rate limiting
            return await func(*args, **kwargs)
        return wrapper
    return wrapper


async def check_rate_limit_impl(key: str, limit: int = 100, window: int = 3600) -> bool:
    """Check rate limit for a given key."""
    return await rate_limiter.is_allowed(key, limit, window)


def check_rate_limit(key: str, limit: int = 100, window: int = 3600):
    """Rate limit dependency factory."""
    async def rate_limit_dependency():
        # For testing, we'll skip rate limiting
        return True
    return rate_limit_dependency