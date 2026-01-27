"""
AIML Service - Microservice for AI/ML competency assessments
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.aiml.database import connect_to_aiml_mongo, close_aiml_mongo_connection
from app.api.v1.aiml.routers import questions as aiml_questions, tests as aiml_tests, assessment as aiml_assessment, run as aiml_run, evaluate as aiml_evaluate
from app.exceptions.handlers import (
    validation_exception_handler,
    not_found_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("aiml-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize main MongoDB connection (for user authentication)
    await connect_to_mongo()
    logger.info("✅ AIML service connected to MongoDB (main)")
    
    # Initialize AIML-specific MongoDB connection (for questions/tests)
    await connect_to_aiml_mongo()
    logger.info("✅ AIML service connected to MongoDB (AIML module)")
    
    yield
    
    # Cleanup: close both connections
    await close_aiml_mongo_connection()
    logger.info("✅ AIML service disconnected from MongoDB (AIML module)")
    await close_mongo_connection()
    logger.info("✅ AIML service disconnected from MongoDB (main)")


app = FastAPI(
    title="AIML Service",
    description="AI/ML competency assessments microservice",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=True,  # Enable automatic trailing slash redirects (default behavior)
)

settings = get_settings()
if settings.cors_origins:
    allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",")]
else:
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-User-Id", "X-Org-Id", "X-Role", "X-Correlation-ID"],
    max_age=600,
)

# Include routers - note: routes with "/" in router become "/api/v1/aiml/tests/" (with trailing slash)
app.include_router(aiml_tests.router, prefix="/api/v1/aiml/tests", tags=["aiml"])
app.include_router(aiml_questions.router)
app.include_router(aiml_assessment.router)
app.include_router(aiml_run.router)
app.include_router(aiml_evaluate.router)

# Debug: Log all registered routes
logger.info("=" * 60)
logger.info("Registered routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        methods = ', '.join(sorted(route.methods))
        logger.info(f"  {methods:20} {route.path}")
logger.info("=" * 60)

# Add route without trailing slash - call the handler directly to avoid redirects
# Import the handler function to reuse the logic
from app.api.v1.aiml.routers.tests import get_tests as get_aiml_tests_handler
from app.core.dependencies import get_current_user

@app.get("/api/v1/aiml/tests", response_model=List[dict], include_in_schema=False)
async def get_aiml_tests_no_slash(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Handle /api/v1/aiml/tests (without trailing slash) by calling the same handler"""
    return await get_aiml_tests_handler(current_user)


app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    return {"message": "AIML Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {"status": "healthy", "service": "aiml-service", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "service": "aiml-service", "database": "disconnected", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3003)

