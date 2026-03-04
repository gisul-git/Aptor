"""
Health check endpoints.
"""

from fastapi import APIRouter, Depends
from typing import Dict, Any
import structlog

from app.core.database import get_database
from app.core.redis_client import get_redis
from app.services.integration_service import get_integration_service, IntegrationService

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "healthy", "service": "Data Engineer Assessment Platform"}


@router.get("/detailed")
async def detailed_health_check() -> Dict[str, Any]:
    """Detailed health check including database and Redis connectivity."""
    health_status = {
        "status": "healthy",
        "service": "Data Engineer Assessment Platform",
        "components": {}
    }
    
    # Check MongoDB connection
    try:
        db = await get_database()
        await db.command("ping")
        health_status["components"]["mongodb"] = {"status": "healthy"}
    except Exception as e:
        logger.error("MongoDB health check failed", error=str(e))
        health_status["components"]["mongodb"] = {"status": "unhealthy", "error": str(e)}
        health_status["status"] = "degraded"
    
    # Check Redis connection
    try:
        redis_client = await get_redis()
        await redis_client.ping()
        health_status["components"]["redis"] = {"status": "healthy"}
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        health_status["components"]["redis"] = {"status": "unhealthy", "error": str(e)}
        health_status["status"] = "degraded"
    
    return health_status


@router.get("/system")
async def system_health_check(
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict[str, Any]:
    """Comprehensive system health check including all integrated components."""
    try:
        # Use integration service for complete system health
        system_health = await integration_service.get_system_health()
        
        logger.info("System health check completed", status=system_health["status"])
        return system_health
        
    except Exception as e:
        logger.error("System health check failed", error=str(e), exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e),
            "service": "Data Engineer Assessment Platform"
        }