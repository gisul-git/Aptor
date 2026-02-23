"""
DSA Service - Microservice for Data Structures and Algorithms assessments 
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.dsa.database import connect_to_dsa_mongo, close_dsa_mongo_connection
from app.api.v1.dsa.routers import tests as dsa_tests, questions as dsa_questions, submissions as dsa_submissions, assessment as dsa_assessment, admin as dsa_admin, run as dsa_run
from app.utils.cache import init_redis_cache
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

logger = logging.getLogger("dsa-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize general MongoDB connection
    await connect_to_mongo()
    logger.info("✅ DSA service connected to MongoDB")
    
    # Initialize DSA-specific MongoDB connection
    await connect_to_dsa_mongo()
    logger.info("✅ DSA service connected to DSA MongoDB")
    
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
        logger.info("✅ DSA service connected to Redis")
        app.state.redis = redis_client
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}. Continuing without cache.")
        app.state.redis = None
    
    yield
    
    # Close Redis connection
    if redis_client:
        try:
            await redis_client.close()
            logger.info("✅ DSA service disconnected from Redis")
        except Exception as e:
            logger.warning(f"Error closing Redis connection: {e}")
    
    # Close DSA-specific MongoDB connection
    await close_dsa_mongo_connection()
    logger.info("✅ DSA service disconnected from DSA MongoDB")
    
    # Close general MongoDB connection
    await close_mongo_connection()
    logger.info("✅ DSA service disconnected from MongoDB")


app = FastAPI(
    title="DSA Service",
    description="Data Structures and Algorithms assessments microservice",
    version="1.0.0",
    lifespan=lifespan,
)

# Add request logging middleware
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"🔵 [DSA Service] Incoming request: {request.method} {request.url.path}")
    logger.info(f"🔵 [DSA Service] Query params: {dict(request.query_params)}")
    logger.info(f"🔵 [DSA Service] Headers: {dict(request.headers)}")
    response = await call_next(request)
    logger.info(f"🟢 [DSA Service] Response: {response.status_code} for {request.method} {request.url.path}")
    return response

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

app.include_router(dsa_tests.router, prefix="/api/v1/dsa/tests", tags=["dsa"])
app.include_router(dsa_questions.router)  # Router already has prefix /api/v1/dsa/questions
logger.info(f"[DSA Service] Registered questions router with prefix: {dsa_questions.router.prefix}")

app.include_router(dsa_submissions.router)  # Router already has prefix /api/v1/dsa
app.include_router(dsa_assessment.router)  # Router already has prefix /api/v1/dsa
app.include_router(dsa_admin.router)  # Router already has prefix /api/v1/dsa/admin
logger.info(f"[DSA Service] Registered admin router with prefix: {dsa_admin.router.prefix}")
# Log admin routes
for route in dsa_admin.router.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        full_path = dsa_admin.router.prefix + route.path
        logger.info(f"[DSA Service] Admin route: {list(route.methods)} {full_path}")

app.include_router(dsa_run.router)  # Router already has prefix /api/v1/dsa

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    return {"message": "DSA Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {"status": "healthy", "service": "dsa-service", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "service": "dsa-service", "database": "disconnected", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3004)

