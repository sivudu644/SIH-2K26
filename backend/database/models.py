"""Pydantic models and SQLite table schemas for all core entities."""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────────────

class ActivityStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


class EventType(str, Enum):
    START = "start"
    PROGRESS = "progress"
    COMPLETION = "completion"
    MILESTONE = "milestone"
    ISSUE = "issue"


class EventStatus(str, Enum):
    EXTRACTED = "extracted"
    MATCHED = "matched"
    REVIEW = "review"
    UNMATCHED = "unmatched"
    APPROVED = "approved"
    REJECTED = "rejected"


class MatchStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    AUTO_MATCHED = "auto_matched"


class Discipline(str, Enum):
    PIPING = "piping"
    CIVIL = "civil"
    ELECTRICAL = "electrical"
    INSTRUMENTATION = "instrumentation"
    MECHANICAL = "mechanical"
    STRUCTURAL = "structural"
    GENERAL = "general"


# ── Core Models ────────────────────────────────────────────────────────

class Project(BaseModel):
    """Top-level project container."""
    project_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class ScheduleActivity(BaseModel):
    """L5/L6 baseline schedule activity."""
    id: Optional[int] = None
    activity_id: str
    wbs: str
    discipline: str
    description: str
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    location: Optional[str] = None
    status: str = ActivityStatus.NOT_STARTED.value
    project_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ProgressEvent(BaseModel):
    """Extracted actual progress event from source documents."""
    id: Optional[int] = None
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_document: Optional[str] = None
    discipline: Optional[str] = None
    raw_text: Optional[str] = None
    normalized_description: Optional[str] = None
    event_type: str = EventType.PROGRESS.value
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    activity_id: Optional[str] = None
    confidence: Optional[float] = None
    status: str = EventStatus.EXTRACTED.value
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class Document(BaseModel):
    """Uploaded source document metadata."""
    id: Optional[int] = None
    document_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    file_type: str
    upload_type: str  # "schedule" or "progress"
    record_count: int = 0
    uploaded_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class MatchCandidate(BaseModel):
    """A candidate match between a ProgressEvent and a ScheduleActivity."""
    id: Optional[int] = None
    match_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    activity_id: str
    similarity_score: float
    confidence_score: float
    description_similarity: float = 0.0
    discipline_similarity: float = 0.0
    token_similarity: float = 0.0
    location_similarity: float = 0.0
    date_compatibility: float = 0.0
    is_ambiguous: bool = False
    explanation: Optional[str] = None
    status: str = MatchStatus.PENDING.value
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ReviewItem(BaseModel):
    """Human-in-the-loop review item for uncertain or ambiguous matches."""
    id: Optional[int] = None
    review_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_id: str
    match_id: Optional[str] = None
    event_description: Optional[str] = None
    activity_description: Optional[str] = None
    activity_id: Optional[str] = None
    confidence: float
    status: str = "pending"  # pending, approved, rejected
    reviewer_notes: Optional[str] = None
    alternative_activity_id: Optional[str] = None
    alternative_activity_desc: Optional[str] = None
    alternative_confidence: Optional[float] = None
    is_ambiguous: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    reviewed_at: Optional[str] = None


class AuditLog(BaseModel):
    """Audit trail entry for all system actions."""
    id: Optional[int] = None
    audit_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    details: Optional[str] = None
    user: str = "system"
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


# ── Request / Response Models ──────────────────────────────────────────

class ScheduleUploadResponse(BaseModel):
    message: str
    document_id: str
    activities_imported: int


class ProgressUploadResponse(BaseModel):
    message: str
    document_id: str
    events_extracted: int


class MatchRunResponse(BaseModel):
    message: str
    total_events: int
    auto_matched: int
    review_required: int
    unmatched: int


class ReviewAction(BaseModel):
    action: str  # "approve", "reject", or "choose_alternative"
    chosen_activity_id: Optional[str] = None
    reviewer_notes: Optional[str] = None


class DashboardData(BaseModel):
    total_activities: int = 0
    total_events: int = 0
    matched_events: int = 0
    avg_confidence: float = 0.0
    review_queue_count: int = 0
    unmatched_count: int = 0
    discipline_progress: List[dict] = []
    confidence_distribution: List[dict] = []
    recent_audits: List[dict] = []
    planned_vs_actual: List[dict] = []


# ── SQL Table Definitions ──────────────────────────────────────────────

TABLE_DEFINITIONS = """
CREATE TABLE IF NOT EXISTS projects (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity_id TEXT NOT NULL UNIQUE,
    wbs TEXT NOT NULL,
    discipline TEXT NOT NULL,
    description TEXT NOT NULL,
    planned_start TEXT,
    planned_finish TEXT,
    location TEXT,
    status TEXT DEFAULT 'not_started',
    project_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    source_document TEXT,
    discipline TEXT,
    raw_text TEXT,
    normalized_description TEXT,
    event_type TEXT DEFAULT 'progress',
    actual_start TEXT,
    actual_finish TEXT,
    activity_id TEXT,
    confidence REAL,
    status TEXT DEFAULT 'extracted',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    upload_type TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    uploaded_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS match_candidates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id TEXT NOT NULL UNIQUE,
    event_id TEXT NOT NULL,
    activity_id TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    confidence_score REAL NOT NULL,
    description_similarity REAL DEFAULT 0.0,
    discipline_similarity REAL DEFAULT 0.0,
    token_similarity REAL DEFAULT 0.0,
    location_similarity REAL DEFAULT 0.0,
    date_compatibility REAL DEFAULT 0.0,
    is_ambiguous INTEGER DEFAULT 0,
    explanation TEXT,
    status TEXT DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL UNIQUE,
    event_id TEXT NOT NULL,
    match_id TEXT,
    event_description TEXT,
    activity_description TEXT,
    activity_id TEXT,
    confidence REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    reviewer_notes TEXT,
    alternative_activity_id TEXT,
    alternative_activity_desc TEXT,
    alternative_confidence REAL,
    is_ambiguous INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    user TEXT DEFAULT 'system',
    timestamp TEXT NOT NULL
);
"""
