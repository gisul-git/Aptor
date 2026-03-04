"""
Custom middleware for the Data Engineer Assessment Platform.
"""

from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable
import structlog
import time
from datetime import datetime, timedelta

from app.core.auth import rate_limiter
from app.core.config import settings

logger = structlog.get_logger()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware for API rate limiting."""
    
    def __init__(self, app, calls_per_minute: int = 60):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Get client identifier (IP address or user ID from token)
        client_ip = request.client.host if request.client else "unknown"
        
        # Create rate limit key
        rate_limit_key = f"rate_limit:{client_ip}"
        
        # Check rate limit (60 requests per minute by default)
        if not await rate_limiter.is_allowed(rate_limit_key, self.calls_per_minute, 60):
            logger.warning(
                "Rate limit exceeded",
                client_ip=client_ip,
                path=request.url.path,
                method=request.method
            )
            
            return Response(
                content='{"error": {"code": 429, "message": "Rate limit exceeded"}}',
                status_code=429,
                headers={
                    "Content-Type": "application/json",
                    "Retry-After": "60"
                }
            )
        
        return await call_next(request)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware for collecting API metrics."""
    
    def __init__(self, app):
        super().__init__(app)
        self.request_count = 0
        self.error_count = 0
        self.total_duration = 0.0
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Increment request counter
        self.request_count += 1
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            self.total_duration += duration
            
            # Log metrics for monitoring
            if response.status_code >= 400:
                self.error_count += 1
                
            # Add metrics headers
            response.headers["X-Response-Time"] = f"{duration:.3f}s"
            
            return response
            
        except Exception as e:
            # Increment error counter
            self.error_count += 1
            
            # Calculate duration
            duration = time.time() - start_time
            self.total_duration += duration
            
            logger.error(
                "Request processing error",
                error=str(e),
                duration=duration,
                path=request.url.path,
                method=request.method
            )
            
            raise
    
    def get_metrics(self) -> dict:
        """Get current metrics."""
        avg_duration = self.total_duration / self.request_count if self.request_count > 0 else 0
        error_rate = self.error_count / self.request_count if self.request_count > 0 else 0
        
        return {
            "total_requests": self.request_count,
            "total_errors": self.error_count,
            "error_rate": error_rate,
            "average_response_time": avg_duration,
            "total_duration": self.total_duration
        }


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Middleware for setting cache control headers."""
    
    def __init__(self, app):
        super().__init__(app)
        self.cache_rules = {
            "/api/v1/questions/": "public, max-age=3600",  # Cache questions for 1 hour
            "/api/v1/health": "public, max-age=60",  # Cache health checks for 1 minute
            "/api/v1/users/": "private, no-cache",  # Don't cache user data
            "/api/v1/execute/": "private, no-cache, no-store",  # Don't cache execution results
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Set cache control headers based on path
        path = request.url.path
        
        for route_pattern, cache_header in self.cache_rules.items():
            if path.startswith(route_pattern):
                response.headers["Cache-Control"] = cache_header
                break
        else:
            # Default cache control
            response.headers["Cache-Control"] = "private, no-cache"
        
        return response


# Global metrics instance
metrics_middleware = None


def get_metrics_middleware() -> MetricsMiddleware:
    """Get the global metrics middleware instance."""
    global metrics_middleware
    return metrics_middleware


def set_metrics_middleware(middleware: MetricsMiddleware):
    """Set the global metrics middleware instance."""
    global metrics_middleware
    metrics_middleware = middleware