"""Unit tests for CSV, XLSX, and TXT document parsers."""

from pathlib import Path
from parsers.csv_parser import parse_schedule_csv, parse_progress_csv
from parsers.xlsx_parser import parse_schedule_xlsx, parse_progress_xlsx
from parsers.txt_parser import parse_daily_report

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_parse_schedule_csv():
    csv_file = DATA_DIR / "sample_schedule.csv"
    with open(csv_file, "r", encoding="utf-8") as f:
        content = f.read()
    activities = parse_schedule_csv(content)
    assert len(activities) >= 30
    first = activities[0]
    assert first.activity_id == "PIP-001"
    assert first.discipline == "piping"
    assert "spool fabrication" in first.description.lower()
    assert first.planned_start is not None


def test_parse_progress_csv():
    csv_file = DATA_DIR / "progress_piping.csv"
    with open(csv_file, "r", encoding="utf-8") as f:
        content = f.read()
    events = parse_progress_csv(content)
    assert len(events) >= 5
    assert all(e.discipline == "piping" for e in events)
    assert any("spool" in e.raw_text.lower() for e in events)


def test_parse_schedule_xlsx():
    xlsx_file = DATA_DIR / "sample_schedule.xlsx"
    with open(xlsx_file, "rb") as f:
        content = f.read()
    activities = parse_schedule_xlsx(content)
    assert len(activities) >= 30
    assert any(a.discipline == "civil" for a in activities)
    assert any(a.discipline == "electrical" for a in activities)


def test_parse_txt_daily_report_piping():
    txt_file = DATA_DIR / "daily_report_piping.txt"
    with open(txt_file, "r", encoding="utf-8") as f:
        content = f.read()
    events = parse_daily_report(content)
    assert len(events) >= 4
    assert all(e.discipline == "piping" for e in events)
    # Check that date was parsed
    assert any(e.actual_start is not None for e in events)


def test_parse_txt_daily_report_civil():
    txt_file = DATA_DIR / "daily_report_civil.txt"
    with open(txt_file, "r", encoding="utf-8") as f:
        content = f.read()
    events = parse_daily_report(content)
    assert len(events) >= 4
    assert all(e.discipline == "civil" for e in events)
