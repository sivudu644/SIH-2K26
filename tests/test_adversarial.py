"""Adversarial and Edge Case Unit Tests for AI Matching Engine."""

import pytest
from database.connection import reset_db
from database.seed import seed_schedule_from_csv
from database.models import ProgressEvent
from services.progress_service import ProgressService
from services.matching_service import MatchingService
from ai.fallback import FallbackAIProvider, _expand_synonyms, _tokenize
from ai.embeddings import compute_discipline_similarity, compute_location_similarity, compute_date_compatibility
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def test_domain_synonym_resolution():
    tokens = _tokenize("RCC foundation concreting second lift")
    expanded = _expand_synonyms(tokens)
    assert "reinforced" in expanded
    assert "concrete" in expanded
    assert "pouring" in expanded


def test_discipline_mismatch_penalty():
    # Severe discipline mismatch should produce low similarity score (0.1)
    disc_score = compute_discipline_similarity("civil", "electrical")
    assert disc_score == 0.1

    # Related disciplines (piping + mechanical) should produce 0.6
    disc_related = compute_discipline_similarity("piping", "mechanical")
    assert disc_related == 0.6

    # Identical disciplines should produce 1.0
    disc_exact = compute_discipline_similarity("electrical", "electrical")
    assert disc_exact == 1.0


def test_activity_id_boundary_matching():
    matcher = MatchingService()
    
    # "PIP-001" in "Completed spool PIP-001" -> exact match 1.0
    score_exact = matcher._compute_token_and_id_similarity(
        "Completed spool PIP-001 in fab yard", None, "PIP-001", "8 inch carbon steel pipe spool fabrication"
    )
    assert score_exact == 1.0

    # "PIP-001" should NOT falsely match "PIP-0010" or "PIP-0011"
    score_non_overlap = matcher._compute_token_and_id_similarity(
        "Completed line PIP-0010 at unit 4", None, "PIP-001", "8 inch carbon steel pipe spool fabrication"
    )
    assert score_non_overlap < 1.0


def test_unrelated_nonsense_event_handling():
    reset_db()
    seed_schedule_from_csv(DATA_DIR / "sample_schedule.csv")

    nonsense_event = ProgressEvent(
        event_id="nonsense-001",
        source_document="random.txt",
        discipline="general",
        raw_text="The cafeteria catering staff arrived with sandwich boxes and fruit juice drinks.",
        normalized_description="cafeteria catering sandwich boxes fruit juice",
        event_type="progress",
        actual_start="2026-08-01",
        status="extracted",
    )
    ProgressService.store_events([nonsense_event], "random.txt", "txt")

    matcher = MatchingService()
    res = matcher.run_matching()

    # Must be marked as unmatched (< 0.65)
    assert res["unmatched"] == 1
    assert res["auto_matched"] == 0
    assert res["review_required"] == 0

    evt = ProgressService.get_event_by_id("nonsense-001")
    assert evt["status"] == "unmatched"
    assert evt["activity_id"] is None
