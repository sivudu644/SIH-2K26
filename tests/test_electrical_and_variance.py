"""Unit tests for Electrical Daily Report parsing and Dashboard Schedule Variance Calculations."""

import pytest
from database.connection import reset_db
from database.seed import seed_schedule_from_csv
from services.progress_service import ProgressService
from services.matching_service import MatchingService
from services.dashboard_service import DashboardService
from parsers.txt_parser import parse_daily_report
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_parse_and_match_electrical_daily_report():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    with open(DATA_DIR / "daily_report_electrical.txt", "r", encoding="utf-8") as f:
        content = f.read()

    events = parse_daily_report(content)
    assert len(events) >= 5
    assert all(e.discipline == "electrical" for e in events)

    doc = ProgressService.store_events(events, "daily_report_electrical.txt", "txt")
    assert doc.record_count >= 5

    matcher = MatchingService()
    res = matcher.run_matching()
    assert res["total_events"] >= 5
    # At least earth grid and cable tray should match electrical schedule activities
    assert res["auto_matched"] + res["review_required"] >= 3


def test_dashboard_schedule_variance_calculation():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    # Ingest civil daily report
    with open(DATA_DIR / "daily_report_civil.txt", "r", encoding="utf-8") as f:
        events = parse_daily_report(f.read())
    ProgressService.store_events(events, "daily_report_civil.txt", "txt")

    matcher = MatchingService()
    matcher.run_matching()

    dash_data = DashboardService.get_dashboard_data()
    assert dash_data["total_activities"] >= 30
    assert dash_data["total_events"] > 0
    assert len(dash_data["discipline_progress"]) > 0

    planned_vs_actual = dash_data["planned_vs_actual"]
    assert len(planned_vs_actual) > 0

    # Ensure variance field is present in each item
    for item in planned_vs_actual:
        assert "variance" in item
        assert "activity_id" in item
        assert "discipline" in item
