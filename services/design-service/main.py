"""
Enhanced Design Service Main Application
AI Design Question Generator + Penpot Integrated Candidate Workspace + Automated Evaluation Engine
"""

import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.exceptions.handlers import add_exception_handlers
from app.api import api_router
from app.repositories.design_repository import design_repository

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
    allow_origins=settings.CORS_ORIGINS + [
        "http://localhost:3000",   # Next.js frontend
        "http://localhost:3001",   # Next.js frontend (alt port)
        "http://localhost:3002",   # Next.js frontend (alt port)
        "http://localhost:3003",   # Next.js frontend (alt port)
        "http://localhost:9001",   # Penpot
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://127.0.0.1:3003",
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


# Legacy Penpot session endpoint for backward compatibility
@app.post("/api/v1/design/penpot-session")
async def create_penpot_session_legacy(candidate_id: str, test_id: str):
    """Legacy endpoint for Penpot session creation"""
    from app.services.penpot_service import penpot_service
    
    try:
        session = await penpot_service.create_candidate_workspace(
            user_id=candidate_id,
            assessment_id=test_id,
            question_id="legacy",
            question_title="Design Challenge"
        )
        
        return {
            "candidate_id": candidate_id,
            "test_id": test_id,
            "session_id": session.session_token,
            "iframe_url": session.workspace_url,
            "storage_path": f"/tmp/penpot_submissions/{candidate_id}/{session.session_token}",
            "team_id": None,
            "project_id": None,
            "file_id": None,
        }
        
    except Exception as e:
        logger.error(f"Legacy Penpot session creation failed: {e}")
        # Fallback response
        import uuid
        session_id = str(uuid.uuid4())
        return {
            "candidate_id": candidate_id,
            "test_id": test_id,
            "session_id": session_id,
            "iframe_url": f"{settings.PENPOT_URL}/#/workspace?token={session_id}&embed=true",
            "storage_path": f"/tmp/penpot_submissions/{candidate_id}/{session_id}",
            "team_id": None,
            "project_id": None,
            "file_id": None,
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
