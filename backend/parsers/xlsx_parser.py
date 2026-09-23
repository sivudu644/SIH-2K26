"""XLSX parser for schedule and progress data files using OpenPyXL."""

from __future__ import annotations

import logging
import uuid
from io import BytesIO
from typing import IO

import pandas as pd

from database.models import ScheduleActivity, ProgressEvent
from .csv_parser import _normalize_columns, SCHEDULE_COL_MAP, PROGRESS_COL_MAP

logger = logging.getLogger(__name__)


def parse_schedule_xlsx(file_content: bytes | IO) -> list[ScheduleActivity]:
    """Parse an XLSX file containing schedule activities.

    Returns a list of ScheduleActivity models.
    """
    try:
        if isinstance(file_content, bytes):
            file_content = BytesIO(file_content)

        df = pd.read_excel(file_content, engine="openpyxl")
        df = _normalize_columns(df, SCHEDULE_COL_MAP)

        activities: list[ScheduleActivity] = []
        for _, row in df.iterrows():
            activity = ScheduleActivity(
                activity_id=str(row.get("activity_id", f"ACT-{uuid.uuid4().hex[:6].upper()}")),
                wbs=str(row.get("wbs", "0.0.0")),
                discipline=str(row.get("discipline", "general")).strip().lower(),
                description=str(row.get("description", "")),
                planned_start=str(row.get("planned_start", "")) if pd.notna(row.get("planned_start")) else None,
                planned_finish=str(row.get("planned_finish", "")) if pd.notna(row.get("planned_finish")) else None,
                location=str(row.get("location", "")) if pd.notna(row.get("location")) else None,
                status=str(row.get("status", "not_started")).strip().lower(),
            )
            activities.append(activity)

        logger.info("Parsed %d schedule activities from XLSX.", len(activities))
        return activities

    except Exception as exc:
        logger.error("Error parsing schedule XLSX: %s", exc)
        raise ValueError(f"Failed to parse schedule XLSX: {exc}") from exc


def parse_progress_xlsx(file_content: bytes | IO) -> list[ProgressEvent]:
    """Parse an XLSX file containing discipline progress data.

    Returns a list of ProgressEvent models.
    """
    try:
        if isinstance(file_content, bytes):
            file_content = BytesIO(file_content)

        df = pd.read_excel(file_content, engine="openpyxl")
        df = _normalize_columns(df, PROGRESS_COL_MAP)

        events: list[ProgressEvent] = []
        for _, row in df.iterrows():
            desc = str(row.get("description", ""))
            remarks = str(row.get("remarks", "")) if pd.notna(row.get("remarks")) else ""
            raw_text = f"{desc}. {remarks}".strip(". ")

            event = ProgressEvent(
                event_id=str(uuid.uuid4()),
                source_document="xlsx_upload",
                discipline=str(row.get("discipline", "general")).strip().lower(),
                raw_text=raw_text,
                normalized_description=desc.strip(),
                event_type="progress",
                actual_start=str(row.get("event_date", "")) if pd.notna(row.get("event_date")) else None,
                activity_id=str(row.get("activity_code", "")) if pd.notna(row.get("activity_code")) else None,
                status="extracted",
            )
            events.append(event)

        logger.info("Parsed %d progress events from XLSX.", len(events))
        return events

    except Exception as exc:
        logger.error("Error parsing progress XLSX: %s", exc)
        raise ValueError(f"Failed to parse progress XLSX: {exc}") from exc
