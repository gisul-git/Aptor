"""
FastAPI main application entry point for Data Engineer Assessment Platform.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import structlog
import time
import uuid
from typing import Callable

from app.core.config import settings
from app.core.database import init_database, close_database
from app.core.redis_client import init_redis, close_redis
from app.core.middleware import RateLimitMiddleware, MetricsMiddleware, CacheControlMiddleware, set_metrics_middleware
from app.core.service_factory import initialize_services, cleanup_services
from app.api.v1.api import api_router

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware for logging HTTP requests and responses."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Start timing
        start_time = time.time()
        
        # Log request
        logger.info(
            "Request started",
            request_id=request_id,
            method=request.method,
            url=str(request.url),
            client_ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        
        # Add request ID to request state
        request.state.request_id = request_id
        
        try:
            # Process request
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log response
            logger.info(
                "Request completed",
                request_id=request_id,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
            )
            
            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration = time.time() - start_time
            
            # Log error
            logger.error(
                "Request failed",
                request_id=request_id,
                error=str(e),
                duration_ms=round(duration * 1000, 2),
            )
            
            # Re-raise the exception
            raise


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware for adding security headers."""
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self'"
        )
        
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting Data Engineer Assessment Platform")
    await init_database()
    await init_redis()
    
    # Initialize all services and wire components together
    await initialize_services()
    
    # Initialize container pool for fast test execution
    if settings.CONTAINER_POOL_ENABLED:
        print("DEBUG: CONTAINER_POOL_ENABLED is True, initializing pool...", flush=True)
        try:
            from app.services.container_pool import get_container_pool
            logger.info("Initializing container pool", pool_size=settings.CONTAINER_POOL_SIZE)
            print(f"DEBUG: About to call get_container_pool() with size {settings.CONTAINER_POOL_SIZE}", flush=True)
            pool = await get_container_pool()
            print(f"DEBUG: Pool initialized! Stats: {pool.get_stats()}", flush=True)
            logger.info("Container pool initialized successfully")
        except Exception as e:
            print(f"DEBUG: Pool initialization FAILED: {e}", flush=True)
            logger.error("Failed to initialize container pool", error=str(e))
            logger.warning("Continuing without container pool - will use on-demand containers")
    else:
        print("DEBUG: CONTAINER_POOL_ENABLED is False", flush=True)
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Data Engineer Assessment Platform")
    
    # Shutdown container pool
    if settings.CONTAINER_POOL_ENABLED:
        try:
            from app.services.container_pool import shutdown_container_pool
            logger.info("Shutting down container pool")
            await shutdown_container_pool()
            logger.info("Container pool shutdown complete")
        except Exception as e:
            logger.error("Failed to shutdown container pool", error=str(e))
    
    # Cleanup services first
    await cleanup_services()
    
    await close_database()
    await close_redis()
    logger.info("Application shutdown complete")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="Data Engineer Assessment Platform",
        description="A secure, scalable coding environment for PySpark assessment with AI-powered question generation and code review",
        version="1.0.0",
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        docs_url=f"{settings.API_V1_STR}/docs",
        redoc_url=f"{settings.API_V1_STR}/redoc",
        lifespan=lifespan,
        redirect_slashes=False  # Disable automatic trailing slash redirects
    )

    # Add security middleware
    app.add_middleware(SecurityHeadersMiddleware)
    
    # Add request logging middleware
    app.add_middleware(RequestLoggingMiddleware)
    
    # Add metrics middleware
    metrics_middleware = MetricsMiddleware(app)
    app.add_middleware(MetricsMiddleware)
    set_metrics_middleware(metrics_middleware)
    
    # Add cache control middleware
    app.add_middleware(CacheControlMiddleware)
    
    # Add rate limiting middleware
    app.add_middleware(RateLimitMiddleware, calls_per_minute=120)
    
    # Add compression middleware
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # Add trusted host middleware for production
    if settings.LOG_LEVEL.upper() == "PRODUCTION":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["localhost", "127.0.0.1", "*.yourdomain.com"]
        )

    # Set up CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-Response-Time"],
    )

    # Custom exception handlers
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions with structured logging."""
        request_id = getattr(request.state, "request_id", "unknown")
        
        logger.error(
            "HTTP exception occurred",
            request_id=request_id,
            status_code=exc.status_code,
            detail=exc.detail,
            url=str(request.url),
            method=request.method,
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.status_code,
                    "message": exc.detail,
                    "request_id": request_id,
                }
            },
            headers={"X-Request-ID": request_id}
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """Handle request validation errors."""
        request_id = getattr(request.state, "request_id", "unknown")
        
        logger.error(
            "Request validation error",
            request_id=request_id,
            errors=exc.errors(),
            url=str(request.url),
            method=request.method,
        )
        
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": 422,
                    "message": "Request validation failed",
                    "details": exc.errors(),
                    "request_id": request_id,
                }
            },
            headers={"X-Request-ID": request_id}
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle unexpected exceptions."""
        request_id = getattr(request.state, "request_id", "unknown")
        
        logger.error(
            "Unexpected error occurred",
            request_id=request_id,
            error=str(exc),
            error_type=type(exc).__name__,
            url=str(request.url),
            method=request.method,
            exc_info=True,
        )
        
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": 500,
                    "message": "Internal server error",
                    "request_id": request_id,
                }
            },
            headers={"X-Request-ID": request_id}
        )

    # Include API router
    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/")
    async def root():
        """Root endpoint for health check."""
        return {
            "message": "Data Engineer Assessment Platform API",
            "version": "1.0.0",
            "status": "healthy",
            "docs_url": f"{settings.API_V1_STR}/docs"
        }

    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {"status": "healthy", "timestamp": time.time()}

    @app.get("/metrics")
    async def get_metrics():
        """Get application metrics."""
        from app.core.middleware import get_metrics_middleware
        
        metrics_middleware = get_metrics_middleware()
        if metrics_middleware:
            return {
                "status": "healthy",
                "metrics": metrics_middleware.get_metrics(),
                "timestamp": time.time()
            }
        else:
            return {
                "status": "healthy",
                "metrics": {"message": "Metrics not available"},
                "timestamp": time.time()
            }

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=3010,
        reload=True,
        log_config=None  # Use structlog configuration
    )