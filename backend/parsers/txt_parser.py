"""TXT daily progress report parser — regex-based extraction of progress events."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Optional

from database.models import ProgressEvent

logger = logging.getLogger(__name__)

# Patterns for extracting structured information from free-text reports
DATE_PATTERN = re.compile(
    r"(?:Date|date|DATE)\s*[:\-]\s*(\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{2}-\w{3}-\d{4})",
)
DISCIPLINE_PATTERNS = [
    re.compile(r"(?:DAILY\s+PROGRESS\s+REPORT\s*[—\-:]+\s*(\w+)(?:\s+DISCIPLINE)?)", re.IGNORECASE),
    re.compile(r"(?:Discipline|Trade|Department)\s*[:\-]\s*(\w+)", re.IGNORECASE),
]
ACTIVITY_PATTERN = re.compile(
    r"^\s*(?:\d+[\.\)]|[-*•])\s+(.+?)(?=(?:^\s*(?:\d+[\.\)]|[-*•])\s+|\Z))",
    re.MULTILINE | re.DOTALL,
)
# Patterns for extracting dates within activity text
INLINE_DATE_PATTERN = re.compile(
    r"(?:started?|commenced?|began|begin|actual start|start date)[:\s]+(\d{2}[/-]\w{3}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{4})",
    re.IGNORECASE,
)
FINISH_DATE_PATTERN = re.compile(
    r"(?:finished|completed|finish date|end date|actual finish)[:\s]+(\d{2}[/-]\w{3}[/-]\d{4}|\d{4}[/-]\d{2}[/-]\d{2}|\d{2}[/-]\d{2}[/-]\d{4})",
    re.IGNORECASE,
)
COMPLETION_PATTERN = re.compile(
    r"(\d+)\s*%\s*(?:complete|completion|done|progress|overall)",
    re.IGNORECASE,
)
COMPLETION_PATTERN_ALT = re.compile(
    r"(?:complete|completion|done|progress|overall)\s*[:\s]*(\d+)\s*%",
    re.IGNORECASE,
)


def _normalize_date(date_str: str) -> Optional[str]:
    """Try to parse various date formats into ISO format."""
    date_str = date_str.strip()
    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d-%b-%Y",
        "%d-%B-%Y",
        "%d/%b/%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return date_str


def _extract_event_type(text: str) -> str:
    """Determine event type from text content."""
    text_lower = text.lower()
    if any(w in text_lower for w in ["completed", "finished", "100%", "released"]):
        return "completion"
    if any(w in text_lower for w in ["started", "commenced", "began", "start"]):
        return "start"
    if any(w in text_lower for w in ["milestone", "achieved", "reached"]):
        return "milestone"
    if any(w in text_lower for w in ["issue", "delay", "problem", "hold", "stuck"]):
        return "issue"
    return "progress"


def _extract_inline_date(text: str, pattern: re.Pattern) -> Optional[str]:
    """Extract a date from within activity text."""
    match = pattern.search(text)
    if match:
        return _normalize_date(match.group(1))
    return None


def parse_daily_report(file_content: str | bytes) -> list[ProgressEvent]:
    """Parse a free-text daily progress report into structured events.

    Extracts:
    - Report date
    - Discipline
    - Individual activity descriptions
    - Inline dates (start/finish)
    - Event types

    Returns a list of ProgressEvent models.
    """
    if isinstance(file_content, bytes):
        file_content = file_content.decode("utf-8")

    events: list[ProgressEvent] = []

    # Extract report-level metadata
    report_date = None
    date_match = DATE_PATTERN.search(file_content)
    if date_match:
        report_date = _normalize_date(date_match.group(1))

    discipline = "general"
    for disc_pat in DISCIPLINE_PATTERNS:
        disc_match = disc_pat.search(file_content)
        if disc_match:
            d = disc_match.group(1).strip().lower()
            if d in ["piping", "civil", "electrical", "instrumentation", "mechanical", "structural"]:
                discipline = d
                break

    # Extract the activities section
    activities_section = file_content
    section_markers = [
        "ACTIVITIES COMPLETED / IN PROGRESS:",
        "ACTIVITIES COMPLETED / IN PROGRESS",
        "ACTIVITIES COMPLETED",
        "ACTIVITIES IN PROGRESS",
        "WORK COMPLETED",
        "WORK DONE",
        "PROGRESS UPDATE",
    ]
    for marker in section_markers:
        idx = file_content.upper().find(marker)
        if idx >= 0:
            # Find end of section
            end_markers = ["ISSUES:", "ISSUES", "TOMORROW'S PLAN:", "TOMORROW", "NEXT DAY", "PROBLEMS", "SAFETY", "MANPOWER"]
            end_idx = len(file_content)
            for em in end_markers:
                ei = file_content.upper().find(em, idx + len(marker))
                if ei >= 0:
                    end_idx = min(end_idx, ei)
            activities_section = file_content[idx:end_idx]
            break

    # Extract numbered activities
    raw_matches = ACTIVITY_PATTERN.findall(activities_section)
    activity_matches = []
    for m in raw_matches:
        cleaned = re.sub(r"\s+", " ", m).strip()
        if len(cleaned) >= 10:
            activity_matches.append(cleaned)

    if not activity_matches:
        # Fallback: split by newlines and look for substantive lines
        for line in activities_section.split("\n"):
            line = line.strip()
            if len(line) > 25 and not line.startswith(("WEATHER", "MANPOWER", "DATE", "-", "DAILY")):
                activity_matches.append(line)

    for raw_text in activity_matches:
        raw_text = raw_text.strip()
        if len(raw_text) < 10:
            continue

        actual_start = _extract_inline_date(raw_text, INLINE_DATE_PATTERN) or report_date
        actual_finish = _extract_inline_date(raw_text, FINISH_DATE_PATTERN)
        event_type = _extract_event_type(raw_text)

        # Clean up the description for matching
        normalized = re.sub(r"\s+", " ", raw_text).strip()
        # Remove date references for cleaner matching
        normalized = re.sub(
            r"(?:started?|commenced?|began)\s+(?:on\s+)?\d{2}[/-]\w{3,9}[/-]\d{4}",
            "",
            normalized,
            flags=re.IGNORECASE,
        ).strip(". ")

        event = ProgressEvent(
            event_id=str(uuid.uuid4()),
            source_document="daily_report",
            discipline=discipline,
            raw_text=raw_text,
            normalized_description=normalized if normalized else raw_text,
            event_type=event_type,
            actual_start=actual_start,
            actual_finish=actual_finish,
            status="extracted",
        )
        events.append(event)

    logger.info(
        "Parsed %d progress events from daily report (discipline=%s, date=%s).",
        len(events),
        discipline,
        report_date,
    )
    return events
