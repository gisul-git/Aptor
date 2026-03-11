"""
API v1 router configuration.
"""

from fastapi import APIRouter

from app.api.v1.endpoints import questions, execution, users, health, monitoring, tests

api_router = APIRouter()

# Include endpoint routers
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(monitoring.router, prefix="/monitoring", tags=["monitoring"])
api_router.include_router(questions.router, prefix="/questions", tags=["questions"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(execution.router, prefix="/execute", tags=["execution"])  # Re-enabled with enterprise engine
api_router.include_router(users.router, prefix="/users", tags=["users"])