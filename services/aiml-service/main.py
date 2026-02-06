"""
AIML Service - Microservice for AI/ML competency assessmentss
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any, Optional

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.aiml.database import connect_to_aiml_mongo, close_aiml_mongo_connection
from app.utils.cache import init_redis_cache
from app.api.v1.aiml.routers import questions as aiml_questions, tests as aiml_tests, assessment as aiml_assessment, run as aiml_run, evaluate as aiml_evaluate
from app.exceptions.handlers import (
    validation_exception_handler,
    http_exception_handler,
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
    
    # Initialize Redis connection
    settings = get_settings()
    redis_client = None
    try:
        import redis.asyncio as redis
        redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=False  # We'll handle encoding manually
        )
        await redis_client.ping()
        init_redis_cache(redis_client)
        logger.info("✅ AIML service connected to Redis")
        app.state.redis = redis_client
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}. Continuing without cache.")
        app.state.redis = None
    
    yield
    
    # Close Redis connection
    if redis_client:
        try:
            await redis_client.close()
            logger.info("✅ AIML service disconnected from Redis")
        except Exception as e:
            logger.warning(f"Error closing Redis connection: {e}")
    
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

# Add request logging middleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        logger.info(f"[AIML-SERVICE] Incoming request: {request.method} {request.url.path}?{request.url.query}")
        response = await call_next(request)
        logger.info(f"[AIML-SERVICE] Response: {response.status_code} for {request.method} {request.url.path}")
        return response

app.add_middleware(LoggingMiddleware)

# Include routers - note: routes with "/" in router become "/api/v1/aiml/tests/" (with trailing slash)
app.include_router(aiml_tests.router, prefix="/api/v1/aiml/tests", tags=["aiml"])
app.include_router(aiml_questions.router)
app.include_router(aiml_assessment.router)
app.include_router(aiml_run.router)
app.include_router(aiml_evaluate.router)

# Add route without trailing slash - call the handler directly to avoid redirects
# Import the handler function to reuse the logic
from app.api.v1.aiml.routers.tests import get_tests as get_aiml_tests_handler, create_test as create_aiml_test_handler, add_candidate as add_candidate_handler, get_test_full_for_candidate as get_test_full_handler
from app.api.v1.aiml.routers.questions import get_questions as get_aiml_questions_handler, create_question as create_aiml_question_handler
from app.core.dependencies import get_current_user, require_editor
from app.api.v1.aiml.models.question import QuestionCreate
from app.api.v1.aiml.models.test import TestCreate, AddCandidateRequest

@app.get("/api/v1/aiml/tests", response_model=List[dict], include_in_schema=False)
async def get_aiml_tests_no_slash(
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=100),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Handle /api/v1/aiml/tests (without trailing slash) by calling the same handler"""
    return await get_aiml_tests_handler(page=page, limit=limit, current_user=current_user)

@app.post("/api/v1/aiml/tests", response_model=dict, include_in_schema=False)
async def create_aiml_test_no_slash(
    test: TestCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """Handle POST /api/v1/aiml/tests (without trailing slash) by calling the same handler"""
    return await create_aiml_test_handler(test, current_user)

@app.get("/api/v1/aiml/questions", response_model=List[dict], include_in_schema=False)
async def get_aiml_questions_no_slash(
    skip: int = Query(0),
    limit: int = Query(1000),
    published_only: Optional[bool] = Query(None),
    library: Optional[str] = Query(None),
    ai_generated: Optional[bool] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Handle /api/v1/aiml/questions (without trailing slash) by calling the same handler"""
    return await get_aiml_questions_handler(
        skip=skip,
        limit=limit,
        published_only=published_only,
        library=library,
        ai_generated=ai_generated,
        current_user=current_user
    )

@app.post("/api/v1/aiml/questions", response_model=dict, include_in_schema=False)
async def create_aiml_question_no_slash(
    question: QuestionCreate,
    current_user: Dict[str, Any] = Depends(require_editor)
):
    """Handle POST /api/v1/aiml/questions (without trailing slash) by calling the same handler"""
    return await create_aiml_question_handler(question, current_user)

@app.post("/api/v1/aiml/tests/{test_id}/add-candidate", response_model=dict, include_in_schema=False)
async def add_candidate_no_slash(
    test_id: str,
    candidate: AddCandidateRequest
):
    """Handle POST /api/v1/aiml/tests/{test_id}/add-candidate (without trailing slash) by calling the same handler"""
    return await add_candidate_handler(test_id, candidate)

@app.get("/api/v1/aiml/tests/{test_id}/full", response_model=dict, include_in_schema=False)
async def get_test_full_no_slash(
    test_id: str
):
    """Handle GET /api/v1/aiml/tests/{test_id}/full (without trailing slash) by calling the same handler"""
    return await get_test_full_handler(test_id)


app.add_exception_handler(RequestValidationError, validation_exception_handler)
# Handle all HTTPExceptions and preserve their original status codes (400, 401, 403, 404, etc.)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)


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

