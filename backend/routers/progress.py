"""Progress router — endpoints for uploading and querying progress data."""

from __future__ import annotations

import logging

from fastapi import APIRouter, File, UploadFile, HTTPException, Query
from typing import Optional

from database.models import ProgressUploadResponse
from parsers.csv_parser import parse_progress_csv
from parsers.xlsx_parser import parse_progress_xlsx
from parsers.txt_parser import parse_daily_report
from services.progress_service import ProgressService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/progress", tags=["Progress"])


@router.post("/upload", response_model=ProgressUploadResponse)
async def upload_progress(file: UploadFile = File(...)):
    """Upload a progress file (CSV, XLSX, or TXT) and extract events."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            events = parse_progress_csv(content)
            file_type = "csv"
        elif filename.endswith((".xlsx", ".xls")):
            events = parse_progress_xlsx(content)
            file_type = "xlsx"
        elif filename.endswith(".txt"):
            events = parse_daily_report(content)
            file_type = "txt"
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Expected CSV, XLSX, or TXT, got: {file.filename}",
            )

        doc = ProgressService.store_events(events, file.filename, file_type)

        return ProgressUploadResponse(
            message=f"Successfully extracted {doc.record_count} progress events.",
            document_id=doc.document_id,
            events_extracted=doc.record_count,
        )

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("Progress upload failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(exc)}")


@router.post("/parse")
async def parse_progress(file: UploadFile = File(...)):
    """Parse a progress file and return extracted events WITHOUT storing them."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    filename = file.filename.lower()

    try:
        if filename.endswith(".csv"):
            events = parse_progress_csv(content)
        elif filename.endswith((".xlsx", ".xls")):
            events = parse_progress_xlsx(content)
        elif filename.endswith(".txt"):
            events = parse_daily_report(content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type.")

        return {
            "events": [e.model_dump() for e in events],
            "count": len(events),
            "source": file.filename,
        }

    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("")
async def get_progress_events(
    status: Optional[str] = Query(None),
    discipline: Optional[str] = Query(None),
):
    """Get all progress events, optionally filtered."""
    try:
        if status:
            events = ProgressService.get_events_by_status(status)
        else:
            events = ProgressService.get_all_events()

        if discipline:
            events = [e for e in events if e.get("discipline", "").lower() == discipline.lower()]

        return {"events": events, "count": len(events)}
    except Exception as exc:
        logger.error("Failed to fetch events: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
