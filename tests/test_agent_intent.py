"""Unit and integration tests for AI Time Agent Intent Guard, Timestamp Safety, and Mixed Messages."""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from database.connection import reset_db, get_db
from database.seed import seed_schedule_from_csv

client = TestClient(app)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure clean baseline database before each intent test."""
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")


@pytest.mark.parametrize(
    "greeting",
    [
        "Hi",
        "Hello",
        "Hey",
        "Good morning",
        "Good evening",
        "Thanks",
        "Thank you",
        "How are you?",
    ],
)
def test_greetings_do_not_trigger_progress_pipeline(greeting):
    """Verify that greetings/casual messages never trigger progress extraction, matching, or DB modification."""
    # 1. Test POST /api/v1/agent/log-progress
    res = client.post("/api/v1/agent/log-progress", json={"message": greeting})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "greeting"
    assert data["extracted_event"] is None
    assert data["top_candidate"] is None
    assert data["confidence_category"] == "conversational"
    assert "CONVERSATIONAL" in data["recommended_action"]
    assert "Hello" in data["message"] or "Agent" in data["message"]

    # 2. Test POST /api/v1/agent/query
    query_res = client.post("/api/v1/agent/query", json={"query": greeting})
    assert query_res.status_code == 200
    q_data = query_res.json()
    assert len(q_data["relevant_activities"]) == 0
    assert len(q_data["relevant_events"]) == 0
    assert "Hello" in q_data["answer"] or "Agent" in q_data["answer"]

    # 3. Verify no records inserted into DB
    with get_db() as conn:
        events = conn.execute("SELECT COUNT(*) as cnt FROM progress_events").fetchone()["cnt"]
        matches = conn.execute("SELECT COUNT(*) as cnt FROM match_candidates").fetchone()["cnt"]
        assert events == 0
        assert matches == 0


@pytest.mark.parametrize(
    "cap_query",
    [
        "What can you do?",
        "How does this work?",
        "What are your capabilities?",
        "Help",
    ],
)
def test_capability_queries(cap_query):
    """Verify that capability questions return informative guidance without triggering progress pipelines."""
    # 1. Log-progress endpoint protection
    res = client.post("/api/v1/agent/log-progress", json={"message": cap_query})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "capability"
    assert data["extracted_event"] is None
    assert data["top_candidate"] is None
    assert "CAPABILITY" in data["recommended_action"]

    # 2. Query endpoint
    q_res = client.post("/api/v1/agent/query", json={"query": cap_query})
    assert q_res.status_code == 200
    q_data = q_res.json()
    assert "Extract" in q_data["answer"] or "AI Time Agent" in q_data["answer"] or "Schedule Linking" in q_data["answer"]


def test_mixed_greeting_and_valid_progress():
    """Verify that mixed greeting + progress messages correctly extract and match progress."""
    msg = "Hi, today we completed spool erection in Area A."
    res = client.post("/api/v1/agent/log-progress", json={"message": msg})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "field_progress"
    assert data["extracted_event"] is not None
    extracted = data["extracted_event"]
    assert extracted["discipline"] == "piping"
    assert extracted["event_type"] == "completion"
    # Greeting should be stripped from normalized description
    assert not extracted["normalized_description"].lower().startswith("hi")
    assert "spool" in extracted["normalized_description"].lower()
    assert data["top_candidate"] is not None
    assert data["confidence_category"] in ("high", "review")


def test_no_fabricated_actual_start():
    """Verify that actual_start remains None (NULL) when not specified in message."""
    msg = "Pipe support installation completed."
    res = client.post("/api/v1/agent/log-progress", json={"message": msg})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "field_progress"
    assert data["extracted_event"] is not None
    assert data["extracted_event"]["actual_start"] is None

    # Test with explicit start
    msg_with_start = "Pipe support installation started at 9 AM and completed at 5 PM."
    res2 = client.post("/api/v1/agent/log-progress", json={"message": msg_with_start})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["extracted_event"]["actual_start"] is not None
    assert "9 AM" in data2["extracted_event"]["actual_start"]


def test_unmatched_progress_handling():
    """Verify that progress not matching any baseline activity is routed to unmatched with no fake activity."""
    msg = "Completed painting the administrative conference room walls."
    res = client.post("/api/v1/agent/log-progress", json={"message": msg})
    assert res.status_code == 200
    data = res.json()
    assert data["confidence_category"] == "unmatched"
    assert "UNMATCHED" in data["recommended_action"]
