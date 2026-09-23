"""Unit tests for Progress Event Deduplication and Matching Idempotency."""

import pytest
from database.connection import reset_db
from database.seed import seed_schedule_from_csv
from database.models import ProgressEvent
from services.progress_service import ProgressService
from services.matching_service import MatchingService
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_progress_event_deduplication():
    reset_db()
    
    event1 = ProgressEvent(
        event_id="dup-test-001",
        source_document="daily_report.txt",
        discipline="piping",
        raw_text="Completed spool fabrication for Area A",
        normalized_description="spool fabrication for Area A",
        actual_start="2026-08-01",
        status="extracted",
    )
    doc1 = ProgressService.store_events([event1], "daily_report.txt", "txt")
    assert doc1.record_count == 1
    assert ProgressService.get_event_count() == 1

    # Second submission of identical event
    event2 = ProgressEvent(
        event_id="dup-test-002",
        source_document="daily_report.txt",
        discipline="piping",
        raw_text="Completed spool fabrication for Area A",
        normalized_description="spool fabrication for Area A",
        actual_start="2026-08-01",
        status="extracted",
    )
    doc2 = ProgressService.store_events([event2], "daily_report.txt", "txt")
    # Duplicate is skipped, count remains 1
    assert doc2.record_count == 0
    assert ProgressService.get_event_count() == 1


def test_matching_engine_idempotency():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    event = ProgressEvent(
        event_id="idemp-001",
        source_document="report.txt",
        discipline="piping",
        raw_text="Completed 8 inch carbon steel pipe spool fabrication in Fab Yard Area A.",
        normalized_description="8 inch carbon steel pipe spool fabrication in Fab Yard Area A",
        actual_start="2026-07-15",
        status="extracted",
    )
    ProgressService.store_events([event], "report.txt", "txt")

    matcher = MatchingService()
    # First matching pass
    res1 = matcher.run_matching()
    assert res1["auto_matched"] == 1

    # Second matching pass on already matched events -> should find 0 unmatched events
    res2 = matcher.run_matching()
    assert res2["total_events"] == 0

    # Ensure match candidate count is clean
    candidates = MatchingService.get_match_candidates("idemp-001")
    assert len(candidates) == 1
