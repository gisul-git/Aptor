"""
Custom MCQ Service - Microservice for custom MCQ/Subjective test management
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.utils.cache import init_redis_cache
from app.api.v1.custom_mcq.routers import router as custom_mcq_router
from app.api.v1.candidate.routers import router as candidate_router
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

logger = logging.getLogger("custom-mcq-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    logger.info("✅ Custom MCQ service connected to MongoDB")
    
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
        logger.info("✅ Custom MCQ service connected to Redis")
        app.state.redis = redis_client
    except Exception as e:
        logger.warning(f"⚠️ Redis connection failed: {e}. Continuing without cache.")
        app.state.redis = None
    
    yield
    
    # Close Redis connection
    if redis_client:
        try:
            await redis_client.close()
            logger.info("✅ Custom MCQ service disconnected from Redis")
        except Exception as e:
            logger.warning(f"Error closing Redis connection: {e}")
    
    await close_mongo_connection()
    logger.info("✅ Custom MCQ service disconnected from MongoDB")


app = FastAPI(
    title="Custom MCQ Service",
    description="Custom MCQ/Subjective test management microservice",
    version="1.0.0",
    lifespan=lifespan,
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

app.include_router(candidate_router)
app.include_router(custom_mcq_router)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    return {"message": "Custom MCQ Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {"status": "healthy", "service": "custom-mcq-service", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "service": "custom-mcq-service", "database": "disconnected", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3002)

