"""Main router for Super Admin API."""
from __future__ import annotations

from fastapi import APIRouter

from . import auth, dashboard, logs, list as list_module, org_admin_logs, demo_requests

router = APIRouter(prefix="/api/v1/super-admin", tags=["super-admin"])

# Include all sub-routers (they have NO prefix to avoid double prefix)
router.include_router(auth.router)
router.include_router(dashboard.router)
router.include_router(logs.router)
router.include_router(list_module.router)
router.include_router(org_admin_logs.router)
router.include_router(demo_requests.router)

