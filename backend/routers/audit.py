"""Audit router — system event log queries."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.audit_service import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/audit", tags=["Audit"])


@router.get("")
async def get_audit_trail(limit: int = Query(50, ge=1, le=500), entity_type: Optional[str] = Query(None)):
    """Get audit trail logs ordered by most recent first."""
    try:
        if entity_type:
            logs = AuditService.get_by_entity(entity_type, "")
            return {"audit_logs": logs, "count": len(logs)}
        logs = AuditService.get_recent(limit=limit)
        return {"audit_logs": logs, "count": len(logs)}
    except Exception as exc:
        logger.error("Failed to fetch audit log: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to fetch audit trail: {str(exc)}")
