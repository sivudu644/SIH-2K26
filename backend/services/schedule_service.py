"""Schedule service — business logic for schedule activities."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from database.connection import get_db
from database.models import ScheduleActivity, Document
from services.audit_service import AuditService

logger = logging.getLogger(__name__)


class ScheduleService:
    """Manages L5/L6 schedule activities."""

    @staticmethod
    def import_activities(activities: list[ScheduleActivity], filename: str, file_type: str) -> Document:
        """Import a list of schedule activities into the database.

        Returns the Document record for the upload.
        """
        now = datetime.now().isoformat()
        doc = Document(
            document_id=str(uuid.uuid4()),
            filename=filename,
            file_type=file_type,
            upload_type="schedule",
            record_count=0,
            uploaded_at=now,
        )
        count = 0

        with get_db() as conn:
            for activity in activities:
                try:
                    conn.execute(
                        """INSERT OR REPLACE INTO schedule_activities
                           (activity_id, wbs, discipline, description,
                            planned_start, planned_finish, location, status, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            activity.activity_id,
                            activity.wbs,
                            activity.discipline,
                            activity.description,
                            activity.planned_start,
                            activity.planned_finish,
                            activity.location,
                            activity.status,
                            now,
                        ),
                    )
                    count += 1
                except Exception as exc:
                    logger.error("Error importing activity %s: %s", activity.activity_id, exc)

            doc.record_count = count
            conn.execute(
                """INSERT INTO documents (document_id, filename, file_type, upload_type, record_count, uploaded_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (doc.document_id, doc.filename, doc.file_type, doc.upload_type, doc.record_count, doc.uploaded_at),
            )

        AuditService.log(
            action="schedule_upload",
            entity_type="document",
            entity_id=doc.document_id,
            details=f"Imported {count} activities from {filename}",
        )
        logger.info("Imported %d schedule activities from %s.", count, filename)
        return doc

    @staticmethod
    def get_all_activities() -> list[dict]:
        """Get all schedule activities."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM schedule_activities ORDER BY wbs, activity_id"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_activity_by_id(activity_id: str) -> dict | None:
        """Get a single schedule activity by its activity_id."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM schedule_activities WHERE activity_id = ?",
                (activity_id,),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_activities_by_discipline(discipline: str) -> list[dict]:
        """Get schedule activities filtered by discipline."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM schedule_activities WHERE LOWER(discipline) = LOWER(?) ORDER BY wbs",
                (discipline,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_activity_count() -> int:
        """Get total number of schedule activities."""
        with get_db() as conn:
            row = conn.execute("SELECT COUNT(*) as c FROM schedule_activities").fetchone()
            return row["c"]

    @staticmethod
    def update_activity_status(activity_id: str, status: str) -> bool:
        """Update the status of a schedule activity."""
        with get_db() as conn:
            cursor = conn.execute(
                "UPDATE schedule_activities SET status = ? WHERE activity_id = ?",
                (status, activity_id),
            )
            if cursor.rowcount > 0:
                AuditService.log(
                    action="activity_status_update",
                    entity_type="schedule_activity",
                    entity_id=activity_id,
                    details=f"Status updated to {status}",
                )
                return True
            return False
