"""
Proctoring Service - Microservice for proctoring and violation management
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.api.v1.proctor.routers import router as proctor_router
from app.api.v1.proctor.verify_face import router as verify_face_router
from app.api.v1.proctoring.routers import router as proctoring_router
from app.services.face_verification_service import face_verification_service
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

logger = logging.getLogger("proctoring-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=" * 60)
    logger.info("🚀 Starting Proctoring Service")
    logger.info("=" * 60)
    settings = get_settings()
    logger.info(f"Configuration: mongo_uri={settings.mongo_uri}, mongo_db={settings.mongo_db}")
    
    try:
        await connect_to_mongo()
        logger.info("✅ Proctoring service connected to MongoDB")
        
        # Verify database after connection
        from app.db.mongo import get_database
        db = get_database()
        db_list = await db.client.list_database_names()
        logger.info(f"📊 MongoDB databases available: {db_list}")
        logger.info(f"📊 Target database '{settings.mongo_db}' in list: {settings.mongo_db in db_list}")
        
        # List collections
        try:
            collections = await db.list_collection_names()
            logger.info(f"📁 Collections in '{settings.mongo_db}': {collections if collections else 'None (database will be created on first insert)'}")
        except Exception as e:
            logger.warning(f"⚠️ Could not list collections: {e}")
            logger.info("ℹ️ This is normal if the database doesn't exist yet - MongoDB creates databases lazily")
    except Exception as e:
        logger.error(f"❌ Failed to connect to MongoDB: {e}")
        raise

    # Initialize DeepFace (ArcFace) model for face verification
    try:
        face_verification_service.initialize()
        logger.info("✅ Face verification service (DeepFace ArcFace) initialized")
    except Exception as e:
        logger.error("❌ Failed to initialize face verification service: %s", str(e))
        # Don't crash the app; verify-face will return 503 until model is available
    
    logger.info("=" * 60)
    yield
    logger.info("=" * 60)
    logger.info("🛑 Shutting down Proctoring Service")
    await close_mongo_connection()
    logger.info("✅ Proctoring service disconnected from MongoDB")
    logger.info("=" * 60)


app = FastAPI(
    title="Proctoring Service",
    description="Proctoring and violation management microservice",
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

app.include_router(proctor_router)
app.include_router(verify_face_router, prefix="/api/v1/proctor", tags=["Face Verification"])
app.include_router(proctoring_router)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    return {"message": "Proctoring Service API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    try:
        from app.db.mongo import get_database
        db = get_database()
        await db.command("ping")
        return {"status": "healthy", "service": "proctoring-service", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "service": "proctoring-service", "database": "disconnected", "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3005)

