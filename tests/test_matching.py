"""Unit tests for the multi-signal AI matching engine and confidence policy."""

from pathlib import Path
from database.seed import seed_schedule_from_csv
from services.progress_service import ProgressService
from services.matching_service import MatchingService
from parsers.txt_parser import parse_daily_report
from parsers.csv_parser import parse_progress_csv

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_matching_engine_full_flow():
    # 1. Seed baseline schedule
    seed_count = seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")
    assert seed_count >= 30

    # 2. Ingest TXT piping daily report
    with open(DATA_DIR / "daily_report_piping.txt", "r", encoding="utf-8") as f:
        events = parse_daily_report(f.read())
    ProgressService.store_events(events, "daily_report_piping.txt", "txt")

    # 3. Ingest CSV progress
    with open(DATA_DIR / "progress_piping.csv", "r", encoding="utf-8") as f:
        csv_events = parse_progress_csv(f.read())
    ProgressService.store_events(csv_events, "progress_piping.csv", "csv")

    # 4. Run matching engine
    matcher = MatchingService()
    result = matcher.run_matching()

    assert result["total_events"] > 0
    assert result["auto_matched"] + result["review_required"] + result["unmatched"] == result["total_events"]
    # At least some events must auto-match with high confidence
    assert result["auto_matched"] >= 1

    # 5. Check review queue
    review_items = MatchingService.get_review_items()
    # Review items should have confidence between 0.65 and 0.84
    for item in review_items:
        assert 0.65 <= item["confidence"] <= 0.8499


def test_approve_and_reject_workflows():
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")
    
    with open(DATA_DIR / "daily_report_civil.txt", "r", encoding="utf-8") as f:
        events = parse_daily_report(f.read())
    ProgressService.store_events(events, "daily_report_civil.txt", "txt")

    matcher = MatchingService()
    matcher.run_matching()

    reviews = MatchingService.get_review_items()
    if reviews:
        first = reviews[0]
        # Approve
        approved = MatchingService.approve_match(first["match_id"], "Verified by QA engineer")
        assert approved is True
        
        # Check review item is no longer in pending list
        remaining = MatchingService.get_review_items()
        assert not any(r["match_id"] == first["match_id"] for r in remaining)
