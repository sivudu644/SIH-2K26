"""Unit tests for Ambiguity Detection and Alternative Candidate Resolution."""

import pytest
from database.connection import reset_db
from database.seed import seed_schedule_from_csv
from database.models import ProgressEvent, ScheduleActivity
from services.progress_service import ProgressService
from services.matching_service import MatchingService
from services.schedule_service import ScheduleService
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_ambiguity_detection_and_alternative_routing():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    # Ingest an ambiguous report that matches both PIP-001 (Fab Yard Area A) and PIP-002 (Unit 100) closely
    ambiguous_event = ProgressEvent(
        event_id="ambig-evt-001",
        source_document="daily_report_ambig.txt",
        discipline="piping",
        raw_text="Completed fabrication and installation of 6 inch and 8 inch steel pipe spools for rack area.",
        normalized_description="fabrication and installation of steel pipe spools for rack area",
        event_type="progress",
        actual_start="2026-08-01",
        status="extracted",
    )
    ProgressService.store_events([ambiguous_event], "daily_report_ambig.txt", "txt")

    matcher = MatchingService()
    res = matcher.run_matching()

    # The ambiguous event should be routed to review queue even if score is high
    assert res["total_events"] == 1
    assert res["review_required"] == 1

    review_items = MatchingService.get_review_items()
    assert len(review_items) == 1
    item = review_items[0]
    
    # Check ambiguity flags and alternative candidates
    assert item["event_id"] == "ambig-evt-001"
    assert item["activity_id"] is not None
    # Alternative candidate should be populated if second match was close
    if item["is_ambiguous"]:
        assert item["alternative_activity_id"] is not None
        assert item["alternative_confidence"] is not None


def test_approve_alternative_candidate():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    event = ProgressEvent(
        event_id="evt-multi-choice",
        source_document="test.txt",
        discipline="piping",
        raw_text="Pipe support installation ongoing at PR-01",
        normalized_description="Pipe support installation at pipe rack PR-01",
        event_type="progress",
        actual_start="2026-08-10",
        status="extracted",
    )
    ProgressService.store_events([event], "test.txt", "txt")

    matcher = MatchingService()
    matcher.run_matching()

    reviews = MatchingService.get_review_items()
    if reviews:
        item = reviews[0]
        # Supervisor explicitly chooses PIP-005
        chosen = "PIP-005"
        approved = MatchingService.approve_match(item["match_id"], "Selected by supervisor", chosen_activity_id=chosen)
        assert approved is True

        # Verify event in DB now has the chosen activity_id
        updated_evt = ProgressService.get_event_by_id(item["event_id"])
        assert updated_evt["activity_id"] == chosen
        assert updated_evt["status"] == "approved"
