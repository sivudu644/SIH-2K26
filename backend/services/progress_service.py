"""Progress event service — business logic for progress data."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime

from database.connection import get_db
from database.models import ProgressEvent, Document
from services.audit_service import AuditService

logger = logging.getLogger(__name__)


class ProgressService:
    """Manages extracted progress events with deduplication and integrity checks."""

    @staticmethod
    def store_events(events: list[ProgressEvent], filename: str, file_type: str) -> Document:
        """Store a list of progress events in the database with deduplication.

        Returns the Document record for the upload.
        """
        now = datetime.now().isoformat()
        doc = Document(
            document_id=str(uuid.uuid4()),
            filename=filename,
            file_type=file_type,
            upload_type="progress",
            record_count=0,
            uploaded_at=now,
        )
        count = 0
        skipped_duplicates = 0

        with get_db() as conn:
            for event in events:
                try:
                    # Deduplication check: check if identical raw_text or normalized_description exists with same date & discipline
                    desc_to_check = event.normalized_description or event.raw_text or ""
                    existing = conn.execute(
                        """SELECT event_id FROM progress_events 
                           WHERE (raw_text = ? OR normalized_description = ?)
                             AND (actual_start = ? OR (actual_start IS NULL AND ? IS NULL))
                             AND (discipline = ? OR (discipline IS NULL AND ? IS NULL))""",
                        (event.raw_text, desc_to_check, event.actual_start, event.actual_start, event.discipline, event.discipline),
                    ).fetchone()

                    if existing:
                        skipped_duplicates += 1
                        logger.debug("Skipping duplicate progress event (matches %s)", existing["event_id"])
                        continue

                    conn.execute(
                        """INSERT INTO progress_events
                           (event_id, source_document, discipline, raw_text,
                            normalized_description, event_type, actual_start,
                            actual_finish, activity_id, confidence, status, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (
                            event.event_id,
                            filename,
                            event.discipline,
                            event.raw_text,
                            event.normalized_description,
                            event.event_type,
                            event.actual_start,
                            event.actual_finish,
                            event.activity_id,
                            event.confidence,
                            event.status,
                            now,
                        ),
                    )
                    count += 1
                except Exception as exc:
                    logger.error("Error storing event %s: %s", event.event_id, exc)

            doc.record_count = count
            conn.execute(
                """INSERT INTO documents (document_id, filename, file_type, upload_type, record_count, uploaded_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (doc.document_id, doc.filename, doc.file_type, doc.upload_type, doc.record_count, doc.uploaded_at),
            )

        AuditService.log(
            action="progress_upload",
            entity_type="document",
            entity_id=doc.document_id,
            details=f"Extracted and stored {count} unique events from {filename} ({skipped_duplicates} duplicates skipped)",
        )
        logger.info("Stored %d progress events from %s (%d duplicates skipped).", count, filename, skipped_duplicates)
        return doc

    @staticmethod
    def get_all_events() -> list[dict]:
        """Get all progress events."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM progress_events ORDER BY created_at DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_event_by_id(event_id: str) -> dict | None:
        """Get a single progress event by event_id."""
        with get_db() as conn:
            row = conn.execute(
                "SELECT * FROM progress_events WHERE event_id = ?",
                (event_id,),
            ).fetchone()
            return dict(row) if row else None

    @staticmethod
    def get_events_by_status(status: str) -> list[dict]:
        """Get events filtered by status."""
        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM progress_events WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def get_event_count() -> int:
        """Get total number of progress events."""
        with get_db() as conn:
            row = conn.execute("SELECT COUNT(*) as c FROM progress_events").fetchone()
            return row["c"]

    @staticmethod
    def update_event(event_id: str, **kwargs) -> bool:
        """Update fields of a progress event."""
        if not kwargs:
            return False
        set_clause = ", ".join(f"{k} = ?" for k in kwargs.keys())
        values = list(kwargs.values()) + [event_id]
        with get_db() as conn:
            cursor = conn.execute(
                f"UPDATE progress_events SET {set_clause} WHERE event_id = ?",
                values,
            )
            return cursor.rowcount > 0
