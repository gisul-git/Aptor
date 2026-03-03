"""
API v1 Router
"""

from fastapi import APIRouter
from app.api.v1.design import router as design_router
from app.api.v1.tests import router as tests_router

api_router = APIRouter()

# Include all v1 routers
api_router.include_router(design_router)
api_router.include_router(tests_router)