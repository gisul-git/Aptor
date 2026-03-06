"""
Auth Service - Microservice for authentication and authorization
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.auth.routers import router as auth_router
from app.api.v1.auth.mfa_routers import router as mfa_router
from app.api.v1.users.routers import router as users_router
from app.exceptions.handlers import (
    validation_exception_handler,
    not_found_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("auth-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    await connect_to_mongo()
    logger.info("✅ Auth service connected to MongoDB")
    
    yield
    
    # Shutdown
    await close_mongo_connection()
    logger.info("✅ Auth service disconnected from MongoDB")


app = FastAPI(
    title="Auth Service",
    description="Authentication and authorization microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"🔵 [Auth Service] Incoming request: {request.method} {request.url.path}")
    logger.info(f"🔵 [Auth Service] Request headers: {dict(request.headers)}")
    logger.info(f"🔵 [Auth Service] Query params: {dict(request.query_params)}")
    logger.info(f"🔵 [Auth Service] Client: {request.client}")
    
    try:
        logger.info(f"🔵 [Auth Service] Calling next middleware/handler...")
        start_time = __import__('time').time()
        
        # Add timeout wrapper to detect hanging
        import asyncio
        try:
            response = await asyncio.wait_for(call_next(request), timeout=60.0)
        except asyncio.TimeoutError:
            logger.error(f"🔴 [Auth Service] Request timed out after 60s!")
            from fastapi import Response
            return Response(
                content='{"detail": "Request timeout"}',
                status_code=504,
                media_type="application/json"
            )
        
        process_time = __import__('time').time() - start_time
        logger.info(f"🟢 [Auth Service] Response: {response.status_code} - {process_time:.3f}s")
        return response
    except Exception as e:
        logger.error(f"🔴 [Auth Service] Middleware error: {e}", exc_info=True)
        logger.error(f"🔴 [Auth Service] Middleware error type: {type(e)}")
        logger.error(f"🔴 [Auth Service] Middleware error repr: {repr(e)}")
        logger.error(f"🔴 [Auth Service] Middleware error args: {e.args if hasattr(e, 'args') else 'No args'}")
        
        # Log the full traceback
        import traceback
        logger.error(f"🔴 [Auth Service] Middleware error traceback:\n{traceback.format_exc()}")
        
        from fastapi import Response
        return Response(
            content=f'{{"detail": "Internal server error: {str(e)}"}}',
            status_code=500,
            media_type="application/json"
        )

# CORS middleware
settings = get_settings()
if settings.cors_origins:
    allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",")]
else:
    allowed_origins = ["http://localhost:3000"]

logger.info(f"✅ CORS allowed origins: {allowed_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-User-Id", "X-Org-Id", "X-Role", "X-Correlation-ID"],
    max_age=600,
)

# Include routers
app.include_router(auth_router)
app.include_router(mfa_router)
app.include_router(users_router)

# Setup exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Auth Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {
            "status": "healthy",
            "service": "auth-service",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "auth-service",
            "database": "disconnected",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4000)

