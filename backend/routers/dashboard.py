"""Dashboard router — metrics and aggregated visualization data."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from database.models import DashboardData
from services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardData)
async def get_dashboard():
    """Fetch live aggregated dashboard data from database."""
    try:
        data = DashboardService.get_dashboard_data()
        return DashboardData(**data)
    except Exception as exc:
        logger.error("Failed to load dashboard data: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard data: {str(exc)}")
