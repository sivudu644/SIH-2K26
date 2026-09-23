"""Integration tests for all REST API endpoints."""

from pathlib import Path
from fastapi.testclient import TestClient
from main import app
from database.seed import seed_schedule_from_csv

client = TestClient(app)
DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["mode"] == "DEMO MODE"


def test_schedule_upload_and_activities():
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        res = client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})
    assert res.status_code == 200
    data = res.json()
    assert data["activities_imported"] >= 30

    # Query activities
    res = client.get("/api/v1/schedule/activities")
    assert res.status_code == 200
    acts = res.json()
    assert acts["count"] >= 30


def test_progress_upload_and_parse():
    txt_path = DATA_DIR / "daily_report_piping.txt"
    with open(txt_path, "rb") as f:
        res = client.post("/api/v1/progress/parse", files={"file": ("daily.txt", f, "text/plain")})
    assert res.status_code == 200
    data = res.json()
    assert data["count"] >= 4

    # Upload for storage
    with open(txt_path, "rb") as f:
        res = client.post("/api/v1/progress/upload", files={"file": ("daily.txt", f, "text/plain")})
    assert res.status_code == 200
    assert res.json()["events_extracted"] >= 4


def test_matching_and_dashboard_and_audit():
    # 1. Ensure schedule is present
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})
    
    # 2. Upload progress events
    csv_prog = DATA_DIR / "progress_piping.csv"
    with open(csv_prog, "rb") as f:
        client.post("/api/v1/progress/upload", files={"file": ("progress_piping.csv", f, "text/csv")})

    # 3. Run matching
    res = client.post("/api/v1/matching/run")
    assert res.status_code == 200
    m_data = res.json()
    assert "auto_matched" in m_data
    assert m_data["total_events"] > 0

    # 4. Check dashboard
    res = client.get("/api/v1/dashboard")
    assert res.status_code == 200
    dash = res.json()
    assert dash["total_activities"] >= 30
    assert dash["total_events"] >= 4
    assert len(dash["discipline_progress"]) > 0

    # 5. Check audit log
    res = client.get("/api/v1/audit")
    assert res.status_code == 200
    audit_data = res.json()
    assert audit_data["count"] > 0


def test_agent_and_memory_endpoints():
    res = client.post("/api/v1/agent/query", json={"query": "What is the status of piping work?"})
    assert res.status_code == 200
    assert "Piping" in res.json()["answer"]

    res = client.get("/api/v1/memory")
    assert res.status_code == 200
    assert "terminology_lexicon" in res.json()


def test_agent_log_progress_extraction_and_matching():
    # 1. Seed schedule
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})

    # 2. Test natural-language supervisor progress message
    message = "Today we completed fabrication of 8 inch carbon steel pipe spools in Fab Yard Area A. Work started at 9 AM and finished at 4:30 PM."
    res = client.post("/api/v1/agent/log-progress", json={"message": message})
    assert res.status_code == 200
    data = res.json()
    
    # Verify extraction
    extracted = data["extracted_event"]
    assert extracted["discipline"] == "piping"
    assert extracted["event_type"] == "completion"
    assert "Fab Yard Area A" in (extracted["location"] or "")
    assert "9 AM" in extracted["actual_start"]
    assert "4:30 PM" in extracted["actual_finish"]

    # Verify high-confidence matching against PIP-001
    top_cand = data["top_candidate"]
    assert top_cand is not None
    assert top_cand["activity_id"] == "PIP-001"
    assert top_cand["confidence_score"] >= 0.85
    assert data["confidence_category"] == "high"
    assert data["recommended_action"] == "HIGH CONFIDENCE — READY TO CONFIRM"
    assert "spool" in top_cand["explanation"].lower() or "confidence" in top_cand["explanation"].lower()


def test_agent_log_progress_review_and_unmatched():
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})

    # Ambiguous review-level message
    review_msg = "Started general civil work and earth moving at the northern plot boundary."
    res = client.post("/api/v1/agent/log-progress", json={"message": review_msg})
    assert res.status_code == 200
    data = res.json()
    assert data["extracted_event"]["discipline"] == "civil"
    assert data["confidence_category"] in ("review", "high")

    # Unrelated unmatched message
    unmatched_msg = "Planted landscaping trees around the kitchen cafeteria lawn."
    res = client.post("/api/v1/agent/log-progress", json={"message": unmatched_msg})
    assert res.status_code == 200
    unmatched_data = res.json()
    assert unmatched_data["confidence_category"] == "unmatched"
    assert unmatched_data["recommended_action"] == "UNMATCHED — REVIEW REQUIRED"


def test_agent_confirm_progress_and_audit():
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})

    # Log progress draft
    message = "Completed fabrication of 8 inch carbon steel pipe spools in Fab Yard Area A."
    log_res = client.post("/api/v1/agent/log-progress", json={"message": message})
    assert log_res.status_code == 200
    draft = log_res.json()["extracted_event"]
    top_cand = log_res.json()["top_candidate"]

    # Confirm progress
    confirm_payload = {
        "draft_id": draft["draft_id"],
        "raw_text": draft["raw_text"],
        "normalized_description": draft["normalized_description"],
        "discipline": draft["discipline"],
        "event_type": draft["event_type"],
        "location": draft["location"],
        "actual_start": draft["actual_start"],
        "actual_finish": draft["actual_finish"],
        "activity_id": top_cand["activity_id"],
        "confidence": top_cand["confidence_score"],
        "reviewer_notes": "Supervisor confirmed in field app",
    }
    confirm_res = client.post("/api/v1/agent/confirm-progress", json=confirm_payload)
    assert confirm_res.status_code == 200
    c_data = confirm_res.json()
    assert c_data["status"] == "approved"
    assert c_data["activity_id"] == "PIP-001"

    # Verify audit log recorded action
    audit_res = client.get("/api/v1/audit")
    assert audit_res.status_code == 200
    logs = audit_res.json()["audit_logs"]
    assert any(log["action"] == "agent_progress_confirmed" for log in logs)


def test_review_queue_approve_and_reject_api_workflows():
    # 1. Seed schedule
    csv_path = DATA_DIR / "sample_schedule.csv"
    with open(csv_path, "rb") as f:
        client.post("/api/v1/schedule/upload", files={"file": ("schedule.csv", f, "text/csv")})

    # 2. Ingest daily report with items that enter the review queue
    txt_path = DATA_DIR / "daily_report_civil.txt"
    with open(txt_path, "rb") as f:
        client.post("/api/v1/progress/upload", files={"file": ("daily_report_civil.txt", f, "text/plain")})

    # Run matching
    match_res = client.post("/api/v1/matching/run")
    assert match_res.status_code == 200

    # 3. Check review queue has items
    q_res = client.get("/api/v1/matching/review")
    assert q_res.status_code == 200
    items = q_res.json()["review_items"]
    assert len(items) >= 1

    item1 = items[0]
    initial_count = len(items)

    # 4. Test Approve via /api/v1/matching/{match_id}/approve
    approve_res = client.post(
        f"/api/v1/matching/{item1['match_id']}/approve",
        json={"action": "approve", "reviewer_notes": "QA approved via test"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["match_id"] == item1["match_id"]

    # Verify item is no longer in pending review queue
    q_res2 = client.get("/api/v1/matching/review")
    items2 = q_res2.json()["review_items"]
    assert len(items2) == initial_count - 1
    assert not any(i["match_id"] == item1["match_id"] for i in items2)

    # Verify audit log has match_approved
    audit_res = client.get("/api/v1/audit")
    assert audit_res.status_code == 200
    logs = audit_res.json()["audit_logs"]
    assert any(log["action"] == "match_approved" and log["entity_id"] == item1["match_id"] for log in logs)

    # 5. Test Reject via /api/v1/reviews/{id}/reject (alias route)
    if len(items2) > 0:
        item2 = items2[0]
        reject_res = client.post(
            f"/api/v1/reviews/{item2['match_id']}/reject",
            json={"action": "reject", "reviewer_notes": "QA rejected via alias route"}
        )
        assert reject_res.status_code == 200
        assert reject_res.json()["match_id"] == item2["match_id"]

        # Verify item2 is no longer in review queue
        q_res3 = client.get("/api/v1/matching/review")
        items3 = q_res3.json()["review_items"]
        assert len(items3) == len(items2) - 1
        assert not any(i["match_id"] == item2["match_id"] for i in items3)

        # Verify audit log has match_rejected
        audit_res2 = client.get("/api/v1/audit")
        logs2 = audit_res2.json()["audit_logs"]
        assert any(log["action"] == "match_rejected" and log["entity_id"] == item2["match_id"] for log in logs2)

    # 6. Test Approve via review_id on /api/v1/reviews/{review_id}/approve
    if len(items3) > 0:
        item3 = items3[0]
        approve_alias_res = client.post(
            f"/api/v1/reviews/{item3['review_id']}/approve",
            json={"action": "approve", "reviewer_notes": "QA approved via review_id on reviews alias"}
        )
        assert approve_alias_res.status_code == 200
        assert approve_alias_res.json()["match_id"] == item3["review_id"]


