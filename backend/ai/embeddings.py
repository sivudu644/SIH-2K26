"""Embedding and similarity computation utilities."""

from __future__ import annotations

import logging
from difflib import SequenceMatcher

from .provider import AIProvider, get_ai_provider

logger = logging.getLogger(__name__)

_provider: AIProvider | None = None


def _get_provider() -> AIProvider:
    global _provider
    if _provider is None:
        _provider = get_ai_provider("fallback")
    return _provider


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Get embedding vectors for a list of texts."""
    provider = _get_provider()
    return [provider.get_embedding(text) for text in texts]


def compute_similarity(text_a: str, text_b: str) -> float:
    """Compute semantic similarity between two texts."""
    provider = _get_provider()
    return provider.compute_similarity(text_a, text_b)


def compute_discipline_similarity(disc_a: str | None, disc_b: str | None) -> float:
    """Compare disciplines — exact match = 1.0, related = 0.6, neutral = 0.5, different = 0.1."""
    if not disc_a or not disc_b:
        return 0.5
    da = disc_a.strip().lower()
    db = disc_b.strip().lower()
    if da == db:
        return 1.0
    if da == "general" or db == "general":
        return 0.7
    related = {
        frozenset({"piping", "mechanical"}): 0.6,
        frozenset({"electrical", "instrumentation"}): 0.6,
        frozenset({"civil", "structural"}): 0.6,
    }
    return related.get(frozenset({da, db}), 0.1)


def compute_location_similarity(loc_a: str | None, loc_b: str | None) -> float:
    """Fuzzy comparison of location strings. Neutral when missing from either."""
    if not loc_a or not loc_b or loc_a.strip() == "" or loc_b.strip() == "":
        return 0.7  # Neutral fallback when location isn't specified in report
    la = loc_a.strip().lower()
    lb = loc_b.strip().lower()
    if la in lb or lb in la:
        return 1.0
    return SequenceMatcher(None, la, lb).ratio()


def compute_date_compatibility(
    event_date: str | None,
    planned_start: str | None,
    planned_finish: str | None,
) -> float:
    """Check if the event date is compatible with the planned date range."""
    if not event_date or (not planned_start and not planned_finish):
        return 0.8  # Neutral fallback

    try:
        from datetime import datetime, timedelta

        def _parse(d: str) -> datetime:
            for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y"):
                try:
                    return datetime.strptime(d.strip(), fmt)
                except ValueError:
                    continue
            raise ValueError(f"Cannot parse date: {d}")

        event_dt = _parse(event_date)
        start = _parse(planned_start) if planned_start else None
        finish = _parse(planned_finish) if planned_finish else None

        if start and finish:
            if start <= event_dt <= finish:
                return 1.0
            if (start - timedelta(days=60)) <= event_dt <= (finish + timedelta(days=60)):
                return 0.85
            return 0.5
        elif start:
            if abs((event_dt - start).days) <= 60:
                return 0.9
            return 0.5
        elif finish:
            if abs((event_dt - finish).days) <= 60:
                return 0.9
            return 0.5
    except Exception:
        return 0.8

    return 0.8
