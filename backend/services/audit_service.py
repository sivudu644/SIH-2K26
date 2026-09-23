"""Audit trail service — logs all system actions."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from database.connection import get_db
from database.models import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """Manages audit trail entries."""

    @staticmethod
    def log(action: str, entity_type: str, entity_id: str | None = None,
            details: str | None = None, user: str = "system") -> None:
        """Create an audit log entry."""
        try:
            with get_db() as conn:
                conn.execute(
                    """INSERT INTO audit_log (audit_id, action, entity_type, entity_id, details, user, timestamp)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        str(uuid.uuid4()),
                        action,
                        entity_type,
                        entity_id,
                        details,
                        user,
                        datetime.now().isoformat(),
                    ),
                )
        except Exception as exc:
            logger.error("Failed to write audit log: %s", exc)

    @staticmethod
    def get_recent(limit: int = 50) -> list[dict]:
        """Get recent audit log entries."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_all() -> list[dict]:
        """Get all audit log entries."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_by_entity(entity_type: str, entity_id: str) -> list[dict]:
        """Get audit entries for a specific entity."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp DESC",
                (entity_type, entity_id),
            ).fetchall()
            return [dict(r) for r in rows]
