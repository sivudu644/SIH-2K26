"""Schedule router — endpoints for uploading and querying schedule activities."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from typing import Optional

from database.models import ScheduleUploadResponse
from parsers.csv_parser import parse_schedule_csv
from parsers.xlsx_parser import parse_schedule_xlsx
from services.schedule_service import ScheduleService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/schedule", tags=["Schedule"])


@router.post("/upload", response_model=ScheduleUploadResponse)
async def upload_schedule(file: UploadFile = File(...)):
    """Upload a schedule file (CSV or XLSX) and import activities."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            activities = parse_schedule_csv(content)
            file_type = "csv"
        elif filename.endswith((".xlsx", ".xls")):
            activities = parse_schedule_xlsx(content)
            file_type = "xlsx"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Expected CSV or XLSX, got: {file.filename}",
            )

        doc = ScheduleService.import_activities(activities, file.filename, file_type)

        return ScheduleUploadResponse(
            message=f"Successfully imported {doc.record_count} schedule activities.",
            document_id=doc.document_id,
            activities_imported=doc.record_count,
        )

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("Schedule upload failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@router.get("/activities")
async def get_activities(discipline: Optional[str] = Query(None)):
    """Get all schedule activities, optionally filtered by discipline."""
    try:
        if discipline:
            activities = ScheduleService.get_activities_by_discipline(discipline)
        else:
            activities = ScheduleService.get_all_activities()
        return {"activities": activities, "count": len(activities)}
    except Exception as exc:
        logger.error("Failed to fetch activities: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
