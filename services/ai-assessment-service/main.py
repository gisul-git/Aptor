"""
AI Assessment Service - Microservice for AI-powered assessment creation and management
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.assessments.routers import router as assessments_router
from app.api.v1.assessments.code_execution import router as code_execution_router
from app.api.v1.candidate.routers import router as candidate_router
from app.api.v1.super_admin.router import router as super_admin_router
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

logger = logging.getLogger("ai-assessment-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    await connect_to_mongo()
    logger.info("✅ AI Assessment service connected to MongoDB")
    
    yield
    
    # Shutdown
    await close_mongo_connection()
    logger.info("✅ AI Assessment service disconnected from MongoDB")


app = FastAPI(
    title="AI Assessment Service",
    description="AI-powered assessment creation and management microservice",
    version="1.0.0",
    lifespan=lifespan,
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
app.include_router(assessments_router)
app.include_router(code_execution_router)
app.include_router(candidate_router)
app.include_router(super_admin_router)

# Setup exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "AI Assessment Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check database connection
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {
            "status": "healthy",
            "service": "ai-assessment-service",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "ai-assessment-service",
            "database": "disconnected",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)

