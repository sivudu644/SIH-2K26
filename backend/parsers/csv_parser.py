"""CSV parser for schedule and progress data files."""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import IO

import pandas as pd

from database.models import ScheduleActivity, ProgressEvent

logger = logging.getLogger(__name__)

# Column name mappings — handles different naming conventions
SCHEDULE_COL_MAP = {
    "activity_id": ["activity_id", "activity id", "act_id", "id", "ref_no", "activity_code"],
    "wbs": ["wbs", "wbs_code", "wbs code"],
    "discipline": ["discipline", "trade", "dept", "department"],
    "description": ["description", "desc", "activity_description", "work_description", "activity_name"],
    "planned_start": ["planned_start", "plan_start", "start_date", "start", "baseline_start"],
    "planned_finish": ["planned_finish", "plan_finish", "finish_date", "finish", "end_date", "baseline_finish"],
    "location": ["location", "area", "zone", "site_area"],
    "status": ["status", "activity_status", "state"],
}

PROGRESS_COL_MAP = {
    "event_date": ["event_date", "date", "report_date", "progress_date"],
    "discipline": ["discipline", "trade", "dept"],
    "activity_code": ["activity_code", "activity_id", "ref_no", "reference"],
    "description": ["description", "work_description", "activity_description", "desc"],
    "quantity": ["quantity", "qty_done", "qty", "amount"],
    "unit": ["unit", "uom", "unit_of_measure"],
    "percent_complete": ["percent_complete", "pct", "cumulative_pct", "progress_pct", "completion"],
    "location": ["location", "area", "zone", "site_area"],
    "remarks": ["remarks", "notes", "comments", "remark"],
}


def _normalize_columns(df: pd.DataFrame, col_map: dict[str, list[str]]) -> pd.DataFrame:
    """Map varied column names to standard names."""
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    rename = {}
    for standard, variants in col_map.items():
        for variant in variants:
            if variant in df.columns and standard not in rename.values():
                rename[variant] = standard
                break
    return df.rename(columns=rename)


def parse_schedule_csv(file_content: str | bytes | IO) -> list[ScheduleActivity]:
    """Parse a CSV file containing schedule activities.

    Returns a list of ScheduleActivity models.
    """
    try:
        if isinstance(file_content, bytes):
            file_content = file_content.decode("utf-8")
        if isinstance(file_content, str):
            file_content = StringIO(file_content)

        df = pd.read_csv(file_content)
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

        logger.info("Parsed %d schedule activities from CSV.", len(activities))
        return activities

    except Exception as exc:
        logger.error("Error parsing schedule CSV: %s", exc)
        raise ValueError(f"Failed to parse schedule CSV: {exc}") from exc


def parse_progress_csv(file_content: str | bytes | IO) -> list[ProgressEvent]:
    """Parse a CSV file containing discipline progress data.

    Returns a list of ProgressEvent models.
    """
    try:
        if isinstance(file_content, bytes):
            file_content = file_content.decode("utf-8")
        if isinstance(file_content, str):
            file_content = StringIO(file_content)

        df = pd.read_csv(file_content)
        df = _normalize_columns(df, PROGRESS_COL_MAP)

        events: list[ProgressEvent] = []
        for _, row in df.iterrows():
            desc = str(row.get("description", ""))
            remarks = str(row.get("remarks", "")) if pd.notna(row.get("remarks")) else ""
            raw_text = f"{desc}. {remarks}".strip(". ")

            event = ProgressEvent(
                event_id=str(uuid.uuid4()),
                source_document="csv_upload",
                discipline=str(row.get("discipline", "general")).strip().lower(),
                raw_text=raw_text,
                normalized_description=desc.strip(),
                event_type="progress",
                actual_start=str(row.get("event_date", "")) if pd.notna(row.get("event_date")) else None,
                activity_id=str(row.get("activity_code", "")) if pd.notna(row.get("activity_code")) else None,
                status="extracted",
            )
            events.append(event)

        logger.info("Parsed %d progress events from CSV.", len(events))
        return events

    except Exception as exc:
        logger.error("Error parsing progress CSV: %s", exc)
        raise ValueError(f"Failed to parse progress CSV: {exc}") from exc
