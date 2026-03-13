"""
Enhanced Design Service Main Application
AI Design Question Generator + Penpot Integrated Candidate Workspace + Automated Evaluation Engine
"""

import logging
import asyncio
import ssl
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.exceptions.handlers import add_exception_handlers
from app.api import api_router
from app.repositories.design_repository import design_repository

# Disable SSL verification for Windows compatibility
ssl._create_default_https_context = ssl._create_unverified_context

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Design Service...")
    
    try:
        # Connect to MongoDB
        await connect_to_mongo()
        
        # Initialize repositories
        try:
            await design_repository.initialize()
            logger.info("Repository initialized successfully")
        except Exception as e:
            logger.warning(f"Repository initialization skipped: {e}")
        
        logger.info("Design Service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start Design Service: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down Design Service...")
    await close_mongo_connection()
    logger.info("Design Service shutdown complete")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="AI-powered design assessment platform with Penpot integration",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list + [
        "http://localhost:3000",   # Next.js frontend
        "http://localhost:3001",   # Next.js frontend (alt port)
        "http://localhost:3002",   # Next.js frontend (alt port)
        "http://localhost:3003",   # Next.js frontend (alt port)
        "http://localhost:3004",   # Next.js frontend (alt port)
        "http://localhost:3005",   # Next.js frontend (alt port)
        "http://localhost:3006",   # Next.js frontend (alt port)
        "http://localhost:3007",   # Next.js frontend (alt port)
        "http://localhost:9001",   # Penpot
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
        "http://127.0.0.1:3004",
        "http://127.0.0.1:3005",
        "http://127.0.0.1:3006",
        "http://127.0.0.1:3007",
        "http://127.0.0.1:9001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add exception handlers
add_exception_handlers(app)

# Include API routes
app.include_router(api_router, prefix="/api")

# Legacy endpoints for backward compatibility
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Design Competency Assessment Service",
        "version": settings.VERSION,
        "status": "running"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "design-service",
        "version": settings.VERSION
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info"
    )
