"""
Employee Service - Microservice for employee management
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.employees.routers import router as employees_router
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

logger = logging.getLogger("employee-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    # Startup
    await connect_to_mongo()
    logger.info("✅ Employee service connected to MongoDB")
    
    yield
    
    # Shutdown
    await close_mongo_connection()
    logger.info("✅ Employee service disconnected from MongoDB")


app = FastAPI(
    title="Employee Service",
    description="Employee management microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"🔵 [Employee Service] Incoming request: {request.method} {request.url.path}")
    try:
        start_time = __import__('time').time()
        response = await call_next(request)
        process_time = __import__('time').time() - start_time
        logger.info(f"🟢 [Employee Service] Response: {response.status_code} - {process_time:.3f}s")
        return response
    except Exception as e:
        logger.error(f"🔴 [Employee Service] Middleware error: {e}", exc_info=True)
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
app.include_router(employees_router)

# Setup exception handlers
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Employee Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {
            "status": "healthy",
            "service": "employee-service",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "employee-service",
            "database": "disconnected",
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4005)

