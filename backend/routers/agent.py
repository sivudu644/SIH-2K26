"""AI Agent & Institutional Memory routers — natural language project queries, progress extraction & historical learnings."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database.connection import get_db
from database.models import ProgressEvent, MatchCandidate, AuditLog
from ai.fallback import SYNONYMS, STOP_WORDS, _tokenize, _expand_synonyms
from ai.embeddings import (
    compute_similarity,
    compute_discipline_similarity,
    compute_location_similarity,
    compute_date_compatibility,
)
from services.matching_service import MatchingService, WEIGHTS, AMBIGUITY_THRESHOLD_DELTA
from services.audit_service import AuditService

logger = logging.getLogger(__name__)

agent_router = APIRouter(prefix="/api/v1/agent", tags=["AI Agent"])
memory_router = APIRouter(prefix="/api/v1/memory", tags=["Institutional Memory"])


# ── Request / Response Models ──────────────────────────────────────────

class AgentQueryRequest(BaseModel):
    query: str


class AgentQueryResponse(BaseModel):
    query: str
    answer: str
    relevant_activities: list[dict] = []
    relevant_events: list[dict] = []
    confidence_level: str = "high"


class LogProgressRequest(BaseModel):
    message: str
    date: Optional[str] = None


class DraftProgressEvent(BaseModel):
    draft_id: str
    discipline: str
    raw_text: str
    normalized_description: str
    event_type: str
    location: Optional[str] = None
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    date: str


class CandidateMatch(BaseModel):
    activity_id: str
    wbs: Optional[str] = None
    discipline: str
    description: str
    location: Optional[str] = None
    planned_start: Optional[str] = None
    planned_finish: Optional[str] = None
    similarity_score: float
    confidence_score: float
    description_similarity: float
    discipline_similarity: float
    token_similarity: float
    location_similarity: float
    date_compatibility: float
    explanation: str


class LogProgressResponse(BaseModel):
    intent: str = "field_progress"  # "greeting", "capability", "project_query", "field_progress", "unclear"
    message: Optional[str] = None
    extracted_event: Optional[DraftProgressEvent] = None
    top_candidate: Optional[CandidateMatch] = None
    candidates: list[CandidateMatch] = []
    confidence_category: str = "unmatched"  # "high", "review", "unmatched", "conversational"
    recommended_action: str = "NONE"


class ConfirmProgressRequest(BaseModel):
    draft_id: str
    raw_text: str
    normalized_description: str
    discipline: str
    event_type: str
    location: Optional[str] = None
    actual_start: Optional[str] = None
    actual_finish: Optional[str] = None
    activity_id: Optional[str] = None
    confidence: float
    reviewer_notes: Optional[str] = None


# ── Intent Classifier ───────────────────────────────────────────────────

PROGRESS_ACTION_KEYWORDS = [
    "completed", "complete", "finished", "finish", "done", "started", "start",
    "commenced", "began", "installed", "erected", "erection", "fabricated",
    "fabrication", "welded", "welding", "poured", "pouring", "concreting",
    "excavated", "excavation", "earthwork", "laid", "laying", "pulled", "pulling",
    "commissioned", "commissioning", "tested", "testing", "hydrotest",
    "insulation", "pigging", "flushing", "grouting", "shuttering", "rebar",
    "ongoing", "in progress", "resumed", "stopped", "work performed", "work completed",
    "bolt-up", "bolting", "radiography", "piling", "curing"
]

PROGRESS_DOMAIN_KEYWORDS = [
    "spool", "pipe", "piping", "header", "flange", "valve", "support", "circuit",
    "foundation", "concrete", "rcc", "pile", "piles", "piling", "trench", "pedestal",
    "cable", "cables", "transformer", "switchgear", "substation", "mcc", "tray",
    "ladder", "earthing", "grounding", "lighting", "generator", "dg", "panel",
    "junction box", "firewater", "drainage", "road", "fencing", "wall", "unit", "rack", "area"
]

GREETING_PATTERNS = [
    r"^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon|howdy|greetings|sup|yo)[.!]?$",
    r"^(?:how\s+are\s+you|how\s+are\s+you\s+doing|how\'s\s+it\s+going|hope\s+you\s+are\s+well)[.?!]?$",
    r"^(?:thanks|thank\s+you|thanks\s+a\s+lot|thank\s+you\s+very\s+much|much\s+appreciated)[.!]?$",
    r"^(?:bye|goodbye|see\s+you|have\s+a\s+good\s+day)[.!]?$",
]

CAPABILITY_PATTERNS = [
    r"what\s+can\s+you\s+do",
    r"how\s+does\s+this\s+work",
    r"how\s+do\s+you\s+work",
    r"what\s+are\s+your\s+capabilities",
    r"what\s+is\s+your\s+purpose",
    r"how\s+to\s+use",
    r"^help[.?!]?$",
    r"^who\s+are\s+you[.?!]?$",
]


def classify_message_intent(text: str) -> str:
    """Classify user intent into greeting, capability, project_query, field_progress, or unclear."""
    t = text.strip().lower()
    if not t:
        return "unclear"

    # 1. Capability question detection
    if any(re.search(pat, t) for pat in CAPABILITY_PATTERNS):
        if not (any(k in t for k in ["completed", "fabricated", "installed", "spool", "pipeline"]) and len(t.split()) > 8):
            return "capability"

    # 2. Pure Greeting / Casual detection
    if any(re.search(pat, t) for pat in GREETING_PATTERNS):
        return "greeting"

    words = [w for w in re.findall(r"[a-z0-9]+", t)]
    if len(words) <= 3 and all(w in ["hi", "hello", "hey", "good", "morning", "evening", "afternoon", "thanks", "thank", "you", "there", "agent", "bot", "how", "are"] for w in words):
        return "greeting"

    # 3. Pure short gibberish / punctuation
    if len(words) < 2 and not any(k in t for k in PROGRESS_ACTION_KEYWORDS) and not any(k in t for k in PROGRESS_DOMAIN_KEYWORDS):
        return "unclear"

    # 4. Project query detection (must be a question or inquiry, without past-tense field reporting)
    query_keywords = ["status", "delay", "delays", "behind", "issue", "variance", "summary", "activities", "schedule", "overview", "show", "list", "what is", "where is", "how many", "pending review"]
    is_question = any(q_kw in t for q_kw in query_keywords) or t.endswith("?")
    has_past_action = any(k in t for k in ["completed", "finished", "installed", "erected", "fabricated", "welded", "poured", "excavated", "laid", "pulled", "started at", "finished at"])

    if is_question and not has_past_action and not any(t.startswith(p) for p in ["today we", "work performed", "started", "completed"]):
        return "project_query"

    # 5. Default to field progress for statements of work/events
    return "field_progress"


# ── Extraction Logic ───────────────────────────────────────────────────

def _extract_discipline_from_text(text: str) -> str:
    """Infer engineering discipline from natural-language text."""
    t = text.lower()
    piping_kw = ["spool", "pipe", "piping", "weld", "welder", "welding", "header", "flange", "hydrotest", "gasket", "fitting", "valve", "rt test", "radiography"]
    civil_kw = ["foundation", "concrete", "rcc", "earthwork", "excavation", "excavate", "pile", "piling", "pedestal", "civil", "trench", "mason", "road", "rebar", "concreting"]
    elec_kw = ["cable", "transformer", "substation", "switchgear", "earthing", "grounding", "lighting", "mcc", "vfd", "dg set", "generator", "electric", "electrical", "cable tray"]
    
    p_score = sum(1 for k in piping_kw if k in t)
    c_score = sum(1 for k in civil_kw if k in t)
    e_score = sum(1 for k in elec_kw if k in t)
    
    if p_score > c_score and p_score > e_score:
        return "piping"
    if c_score > p_score and c_score > e_score:
        return "civil"
    if e_score > p_score and e_score > c_score:
        return "electrical"
    return "general"


def _extract_event_type_from_text(text: str) -> str:
    """Infer event type from text."""
    t = text.lower()
    if any(k in t for k in ["completed", "complete", "finished", "finish", "done", "erected", "installed", "100%", "released"]):
        return "completion"
    if any(k in t for k in ["started", "start", "commenced", "began", "begin"]):
        return "start"
    if any(k in t for k in ["delay", "issue", "problem", "hold", "failed", "stuck"]):
        return "issue"
    if any(k in t for k in ["milestone"]):
        return "milestone"
    return "progress"


def _extract_location_from_text(text: str) -> Optional[str]:
    """Extract location references like 'in Fab Yard Area A', 'at Unit 100', 'on Rack PR-01', 'in Area A'."""
    loc_pattern = re.search(
        r"\b(?:in|at|on)\s+((?:Fab\s+Yard(?:\s+Area\s+[A-Za-z0-9]+)?|Area\s+[A-Za-z0-9]+|Unit\s+[A-Za-z0-9]+(?:\s*-\s*Rack\s+[A-Za-z0-9]+)?|Pipe\s+Rack\s+[A-Za-z0-9]+|Rack\s+[A-Za-z0-9]+|MCC\s+Room\s*\d*|DG\s+Room|Substation\s+Area|Cable\s+Gallery\s+[A-Za-z0-9]+|Main\s+Cable\s+Route|Plant\s+Boundary|Utility\s+Area|Plant\s+Access\s+Roads|[A-Za-z0-9\s\-]+?(?:Area\s+[A-Za-z0-9]+|Unit\s+[A-Za-z0-9]+|Rack\s+[A-Za-z0-9]+|Room\s+[A-Za-z0-9]+|Plot|Yard|Route|Substation)))",
        text,
        re.IGNORECASE,
    )
    if loc_pattern:
        loc = loc_pattern.group(1).strip()
        return loc.rstrip(".,; ")
    return None


def _extract_time_or_date(text: str, start_or_finish: str) -> Optional[str]:
    """Extract start or finish time/date strings from text without fabricating timestamps."""
    today = datetime.now().strftime("%Y-%m-%d")
    
    if start_or_finish == "start":
        m = re.search(r"(?:started|began|commenced|start)(?:\s+at|\s+on|\s*:)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)", text, re.IGNORECASE)
        if m:
            return f"{today} {m.group(1).strip()}"
        d = re.search(r"(?:started|began|commenced|start)(?:\s+on|\s*:)?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\w{3}[/-]\d{4})", text, re.IGNORECASE)
        if d:
            return d.group(1).strip()
        return None  # Never fabricate actual_start
    else:
        m = re.search(r"(?:finished|completed|ended|finish)(?:\s+at|\s+on|\s*:)?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)", text, re.IGNORECASE)
        if m:
            return f"{today} {m.group(1).strip()}"
        d = re.search(r"(?:finished|completed|ended|finish)(?:\s+on|\s*:)?\s*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\w{3}[/-]\d{4})", text, re.IGNORECASE)
        if d:
            return d.group(1).strip()
        return None


def parse_supervisor_message(message: str, date_override: Optional[str] = None) -> DraftProgressEvent:
    """Parse natural language supervisor message into a draft ProgressEvent."""
    clean_msg = message.strip()
    discipline = _extract_discipline_from_text(clean_msg)
    event_type = _extract_event_type_from_text(clean_msg)
    location = _extract_location_from_text(clean_msg)
    
    today = date_override or datetime.now().strftime("%Y-%m-%d")
    actual_start = _extract_time_or_date(clean_msg, "start")
    actual_finish = _extract_time_or_date(clean_msg, "finish")
    
    # Normalized description: clean up greetings, time/date specifics for matching
    normalized = re.sub(r"(?i)^(?:hi|hello|hey|good\s+morning|good\s+evening|good\s+afternoon|dear\s+team|greetings)[,\s]+", "", clean_msg)
    normalized = re.sub(r"(?i)work\s+started\s+at\s+\S+(?:\s+[AP]M)?", "", normalized)
    normalized = re.sub(r"(?i)and\s+finished\s+at\s+\S+(?:\s+[AP]M)?", "", normalized)
    normalized = re.sub(r"(?i)today\s+we\s+", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip(" .,;")

    return DraftProgressEvent(
        draft_id=str(uuid.uuid4()),
        discipline=discipline,
        raw_text=clean_msg,
        normalized_description=normalized if normalized else clean_msg,
        event_type=event_type,
        location=location,
        actual_start=actual_start,
        actual_finish=actual_finish,
        date=today,
    )


# ── Endpoints ──────────────────────────────────────────────────────────

@agent_router.post("/query", response_model=AgentQueryResponse)
async def query_time_agent(req: AgentQueryRequest):
    """Query the AI Time Agent about project schedule, delays, actuals, and variances dynamically."""
    if not req.query or not req.query.strip():
        raise HTTPException(status_code=400, detail="Empty query provided.")

    q = req.query.lower().strip()
    intent = classify_message_intent(req.query)

    if intent == "greeting":
        return AgentQueryResponse(
            query=req.query,
            answer="Hello! I am your AI Time Agent for Project Controls. You can ask me about project status, schedule activities, and variances, or report actual field execution progress to link with the L5/L6 schedule.",
            relevant_activities=[],
            relevant_events=[],
            confidence_level="high",
        )

    if intent == "capability":
        return AgentQueryResponse(
            query=req.query,
            answer="I am the AI Time Agent for SIH26122 Schedule Linking. I can:\n• Extract field progress from daily supervisor logs\n• Multi-signal match progress to L5/L6 baseline activities\n• Track planned vs actual schedule variances and delays\n• Maintain institutional memory and domain terminology lexicon\n• Answer live questions about project disciplines, activities, and review items.",
            relevant_activities=[],
            relevant_events=[],
            confidence_level="high",
        )

    with get_db() as conn:
        activities = [dict(r) for r in conn.execute("SELECT * FROM schedule_activities").fetchall()]
        events = [dict(r) for r in conn.execute("SELECT * FROM progress_events").fetchall()]
        reviews = [dict(r) for r in conn.execute("SELECT * FROM review_items").fetchall()]

    if not activities and not events:
        if "piping" in q:
            answer = "Piping Discipline Status: There is insufficient recorded project data (0 baseline schedule activities, 0 progress reports recorded)."
        elif "civil" in q:
            answer = "Civil Discipline Status: There is insufficient recorded project data (0 baseline schedule activities, 0 field updates recorded)."
        elif "electrical" in q:
            answer = "Electrical Discipline Status: There is insufficient recorded project data (0 baseline activities, 0 field updates recorded)."
        elif any(k in q for k in ["delay", "behind", "issue", "problem"]):
            answer = "There is insufficient recorded project data to determine execution delays or issue events."
        elif any(k in q for k in ["review", "pending", "queue"]):
            answer = "The human-in-the-loop review queue is currently empty as there is insufficient recorded project data."
        else:
            answer = "There is insufficient recorded project data to determine that. Please upload a baseline schedule or field progress reports."
        return AgentQueryResponse(
            query=req.query,
            answer=answer,
            relevant_activities=[],
            relevant_events=[],
            confidence_level="low",
        )

    matched_acts = []
    matched_evts = []

    words = [w for w in q.split() if len(w) > 2 and w not in STOP_WORDS]
    for act in activities:
        act_text = f"{act['activity_id']} {act['discipline']} {act['description']} {act.get('location') or ''}".lower()
        if any(w in act_text for w in words):
            matched_acts.append(act)

    for evt in events:
        evt_text = f"{evt['event_id']} {evt['discipline']} {evt.get('raw_text') or ''} {evt.get('normalized_description') or ''}".lower()
        if any(w in evt_text for w in words):
            matched_evts.append(evt)

    # Dynamic database-backed responses
    if any(k in q for k in ["delay", "behind", "issue", "problem"]):
        issue_events = [e for e in events if e.get("event_type") == "issue" or any(w in (e.get("raw_text") or "").lower() for w in ["delay", "issue", "problem", "failed", "hold"])]
        if issue_events:
            disciplines_affected = set(e.get("discipline") for e in issue_events if e.get("discipline"))
            disc_str = ", ".join(d.capitalize() for d in disciplines_affected) if disciplines_affected else "General"
            sample_descs = "; ".join(f"[{e.get('discipline', '').upper()}] {e.get('normalized_description') or e.get('raw_text')}" for e in issue_events[:2])
            answer = f"Found {len(issue_events)} recorded execution issues/delays across {disc_str}. Reported: {sample_descs}."
        else:
            answer = "No execution delays or issue events are currently recorded in the project progress logs."

    elif "piping" in q:
        pip_acts = [a for a in activities if a.get("discipline") == "piping"]
        pip_evts = [e for e in events if e.get("discipline") == "piping"]
        pip_matched = [e for e in pip_evts if e.get("status") in ("matched", "approved")]
        if pip_acts or pip_evts:
            sample_acts = ", ".join(f"{a['activity_id']} ({a['description']})" for a in pip_acts[:2]) if pip_acts else "None"
            answer = f"Piping Discipline Status: {len(pip_acts)} baseline schedule activities recorded, with {len(pip_evts)} progress reports captured ({len(pip_matched)} linked). Active items include: {sample_acts}."
        else:
            answer = "There is insufficient recorded project data for the Piping discipline."

    elif "civil" in q:
        civ_acts = [a for a in activities if a.get("discipline") == "civil"]
        civ_evts = [e for e in events if e.get("discipline") == "civil"]
        civ_matched = [e for e in civ_evts if e.get("status") in ("matched", "approved")]
        if civ_acts or civ_evts:
            sample_acts = ", ".join(f"{a['activity_id']} ({a['description']})" for a in civ_acts[:2]) if civ_acts else "None"
            answer = f"Civil Discipline Status: {len(civ_acts)} baseline schedule activities tracked, with {len(civ_evts)} field updates recorded ({len(civ_matched)} linked). Active items include: {sample_acts}."
        else:
            answer = "There is insufficient recorded project data for the Civil discipline."

    elif "electrical" in q:
        ele_acts = [a for a in activities if a.get("discipline") == "electrical"]
        ele_evts = [e for e in events if e.get("discipline") == "electrical"]
        ele_matched = [e for e in ele_evts if e.get("status") in ("matched", "approved")]
        if ele_acts or ele_evts:
            sample_acts = ", ".join(f"{a['activity_id']} ({a['description']})" for a in ele_acts[:2]) if ele_acts else "None"
            answer = f"Electrical Discipline Status: {len(ele_acts)} baseline activities logged, with {len(ele_evts)} field updates recorded ({len(ele_matched)} linked). Active items include: {sample_acts}."
        else:
            answer = "There is insufficient recorded project data for the Electrical discipline."

    elif any(k in q for k in ["review", "pending", "queue"]):
        pending = [r for r in reviews if r.get("status") == "pending"]
        if pending:
            answer = f"There are currently {len(pending)} items awaiting human-in-the-loop review in the confidence range [0.65 - 0.84] or flagged for candidate ambiguity."
        else:
            answer = "The human-in-the-loop review queue is clear. All recorded progress events have been resolved or auto-matched."

    elif any(k in q for k in ["variance", "schedule", "status", "overview", "summary"]):
        completed_acts = [a for a in activities if a.get("status") == "completed"]
        in_prog_acts = [a for a in activities if a.get("status") == "in_progress"]
        matched_count = len([e for e in events if e.get("status") in ("matched", "approved")])
        rate = round((matched_count / max(len(events), 1)) * 100) if events else 0
        answer = f"Schedule Baseline Overview: {len(activities)} total activities ({len(completed_acts)} completed, {len(in_prog_acts)} in progress). {len(events)} execution events captured with a {rate}% linkage rate."
    else:
        if matched_acts or matched_evts:
            matched_count = len([e for e in events if e.get("status") in ("matched", "approved")])
            answer = f"Found {len(matched_acts)} relevant schedule activities and {len(matched_evts)} progress events matching your query from the live project database."
        else:
            answer = "There is insufficient recorded project data matching your specific inquiry. You can ask about disciplines (Piping, Civil, Electrical), schedule status, delays, or pending reviews."

    return AgentQueryResponse(
        query=req.query,
        answer=answer,
        relevant_activities=matched_acts[:5],
        relevant_events=matched_evts[:5],
        confidence_level="high" if (matched_acts or matched_evts) else "medium",
    )


@agent_router.post("/log-progress", response_model=LogProgressResponse)
async def log_progress_from_message(req: LogProgressRequest):
    """Extract draft progress event from natural language with strict intent protection."""
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty progress message provided.")

    intent = classify_message_intent(req.message)

    # Backend Intent Guard: Non-progress intents MUST NOT trigger extraction/matching/DB operations
    if intent == "greeting":
        return LogProgressResponse(
            intent="greeting",
            message="Hello! I am your AI Time Agent for Infrastructure Project Controls. To log field progress, describe what execution work was performed (e.g., 'Completed erection of spool SP-104 in Area A'). You can also ask me questions about project status and schedule activities.",
            extracted_event=None,
            top_candidate=None,
            candidates=[],
            confidence_category="conversational",
            recommended_action="CONVERSATIONAL — NO PROGRESS ACTION REQUIRED",
        )

    if intent == "capability":
        return LogProgressResponse(
            intent="capability",
            message="I am the AI Time Agent for SIH26122. I can:\n1. Extract structured execution events from natural language field updates.\n2. Match progress against L5/L6 baseline schedule activities using 5-signal AI similarity.\n3. Route events to high-confidence auto-links or human review.\n4. Update schedule actuals, variances, and audit trails.\n5. Answer inquiries about baseline activities, delays, and progress.",
            extracted_event=None,
            top_candidate=None,
            candidates=[],
            confidence_category="conversational",
            recommended_action="CAPABILITY OVERVIEW — NO PROGRESS ACTION REQUIRED",
        )

    if intent == "unclear":
        return LogProgressResponse(
            intent="unclear",
            message="I did not detect specific field progress execution details or a schedule query in your message. Please provide details such as the activity performed, location, or time (e.g., 'Completed welding on header H-201 at Unit 200').",
            extracted_event=None,
            top_candidate=None,
            candidates=[],
            confidence_category="conversational",
            recommended_action="CLARIFICATION REQUIRED",
        )

    # 1. Parse natural-language message
    draft_event = parse_supervisor_message(req.message, req.date)

    # 2. Query all schedule activities from database
    with get_db() as conn:
        activities = [dict(a) for a in conn.execute("SELECT * FROM schedule_activities").fetchall()]

    if not activities:
        raise HTTPException(status_code=400, detail="No schedule activities exist in the database.")

    # 3. Run multi-signal matching
    matcher = MatchingService()
    matcher._build_corpus()

    candidates: list[CandidateMatch] = []

    for act in activities:
        desc_sim = compute_similarity(draft_event.normalized_description, act["description"])
        disc_sim = compute_discipline_similarity(draft_event.discipline, act.get("discipline"))
        token_sim = matcher._compute_token_and_id_similarity(
            draft_event.normalized_description,
            None,
            act["activity_id"],
            act["description"],
        )
        loc_sim = compute_location_similarity(draft_event.location, act.get("location"))
        date_compat = compute_date_compatibility(
            draft_event.actual_start.split()[0] if draft_event.actual_start else None,
            act.get("planned_start"),
            act.get("planned_finish"),
        )

        final_score = (
            WEIGHTS["description"] * desc_sim
            + WEIGHTS["discipline"] * disc_sim
            + WEIGHTS["token"] * token_sim
            + WEIGHTS["location"] * loc_sim
            + WEIGHTS["date"] * date_compat
        )

        explanation = matcher.ai_provider.generate_explanation(
            draft_event.normalized_description,
            act["description"],
            final_score,
        )

        cand = CandidateMatch(
            activity_id=act["activity_id"],
            wbs=act.get("wbs"),
            discipline=act.get("discipline", "general"),
            description=act["description"],
            location=act.get("location"),
            planned_start=act.get("planned_start"),
            planned_finish=act.get("planned_finish"),
            similarity_score=round(desc_sim, 4),
            confidence_score=round(final_score, 4),
            description_similarity=round(desc_sim, 4),
            discipline_similarity=round(disc_sim, 4),
            token_similarity=round(token_sim, 4),
            location_similarity=round(loc_sim, 4),
            date_compatibility=round(date_compat, 4),
            explanation=explanation,
        )
        candidates.append(cand)

    # Sort candidates by confidence score descending
    candidates.sort(key=lambda c: c.confidence_score, reverse=True)
    top_candidate = candidates[0] if candidates else None
    second_candidate = candidates[1] if len(candidates) > 1 else None

    # Confidence category & recommended action
    top_score = top_candidate.confidence_score if top_candidate else 0.0
    second_score = second_candidate.confidence_score if second_candidate else 0.0

    is_ambiguous = bool(
        second_candidate
        and second_score >= matcher.review_threshold
        and round(top_score - second_score, 2) <= AMBIGUITY_THRESHOLD_DELTA
    )

    if top_score >= matcher.auto_threshold and not is_ambiguous:
        category = "high"
        recommended_action = "HIGH CONFIDENCE — READY TO CONFIRM"
    elif top_score >= matcher.review_threshold or is_ambiguous:
        category = "review"
        if is_ambiguous:
            recommended_action = f"AMBIGUOUS CANDIDATES (Δ={round((top_score - second_score)*100, 1)}%) — REVIEW REQUIRED"
        else:
            recommended_action = "REVIEW REQUIRED"
    else:
        category = "unmatched"
        recommended_action = "UNMATCHED — REVIEW REQUIRED"

    return LogProgressResponse(
        intent="field_progress",
        extracted_event=draft_event,
        top_candidate=top_candidate,
        candidates=candidates[:5],
        confidence_category=category,
        recommended_action=recommended_action,
    )


@agent_router.post("/confirm-progress")
async def confirm_progress_event(req: ConfirmProgressRequest):
    """Confirm draft progress event and commit to ProgressEvents, MatchCandidates, and ScheduleActuals with audit trail."""
    try:
        now = datetime.now().isoformat()
        event_id = str(uuid.uuid4())
        match_id = str(uuid.uuid4())

        with get_db() as conn:
            # Validate that activity_id actually exists in schedule_activities
            activity_id = None
            status = "unmatched"
            if req.activity_id:
                act_exists = conn.execute(
                    "SELECT activity_id FROM schedule_activities WHERE activity_id = ?",
                    (req.activity_id,),
                ).fetchone()
                if act_exists and req.confidence >= 0.65:
                    activity_id = req.activity_id
                    status = "approved"

            # 1. Insert into progress_events
            conn.execute(
                """INSERT INTO progress_events
                   (event_id, source_document, discipline, raw_text, normalized_description,
                    event_type, actual_start, actual_finish, activity_id, confidence, status, created_at)
                   VALUES (?, 'ai_time_agent', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    event_id,
                    req.discipline,
                    req.raw_text,
                    req.normalized_description,
                    req.event_type,
                    req.actual_start,
                    req.actual_finish,
                    activity_id,
                    req.confidence,
                    status,
                    now,
                ),
            )

            # 2. Insert into match_candidates if activity matched
            if activity_id:
                conn.execute(
                    """INSERT INTO match_candidates
                       (match_id, event_id, activity_id, similarity_score, confidence_score,
                        status, reviewed_by, reviewed_at, created_at)
                       VALUES (?, ?, ?, ?, ?, 'approved', 'supervisor', ?, ?)""",
                    (
                        match_id,
                        event_id,
                        activity_id,
                        req.confidence,
                        req.confidence,
                        now,
                        now,
                    ),
                )

                # 3. Update schedule activity status if completion or start
                if req.event_type == "completion":
                    conn.execute("UPDATE schedule_activities SET status = 'completed' WHERE activity_id = ?", (activity_id,))
                else:
                    conn.execute("UPDATE schedule_activities SET status = 'in_progress' WHERE activity_id = ?", (activity_id,))

        # 4. Record in Audit Log
        AuditService.log(
            action="agent_progress_confirmed",
            entity_type="progress_event",
            entity_id=event_id,
            details=f"Supervisor confirmed progress: linked to [{activity_id or 'UNLINKED'}] with confidence {req.confidence*100:.1f}%. Notes: {req.reviewer_notes or 'none'}",
            user="supervisor",
        )

        return {
            "message": "Progress event confirmed and schedule updated successfully.",
            "event_id": event_id,
            "activity_id": activity_id,
            "status": status,
            "confidence": req.confidence,
        }

    except Exception as exc:
        logger.error("Failed to confirm progress event: %s", exc)
        raise HTTPException(status_code=500, detail=f"Confirmation failed: {str(exc)}")


@memory_router.get("")
async def get_institutional_memory():
    """Retrieve learned terminology patterns, matching accuracy stats, and discipline ontology mappings."""
    with get_db() as conn:
        approved_matches = conn.execute(
            """SELECT mc.*, sa.description as act_desc, pe.raw_text as event_text, sa.discipline
               FROM match_candidates mc
               JOIN schedule_activities sa ON mc.activity_id = sa.activity_id
               JOIN progress_events pe ON mc.event_id = pe.event_id
               WHERE mc.status IN ('approved', 'auto_matched')
               ORDER BY mc.confidence_score DESC
               LIMIT 50"""
        ).fetchall()
        
        counts = conn.execute(
            """SELECT 
                 COUNT(CASE WHEN status='auto_matched' THEN 1 END) as auto_count,
                 COUNT(CASE WHEN status='approved' THEN 1 END) as approved_count,
                 COUNT(CASE WHEN status='rejected' THEN 1 END) as rejected_count,
                 COUNT(*) as total_count,
                 AVG(confidence_score) as avg_score
               FROM match_candidates"""
        ).fetchone()

    synonym_list = [{"alias": k, "canonical": v} for k, v in sorted(SYNONYMS.items())]

    return {
        "stats": {
            "total_matches_evaluated": counts["total_count"] if counts else 0,
            "auto_matches": counts["auto_count"] if counts else 0,
            "human_approved": counts["approved_count"] if counts else 0,
            "human_rejected": counts["rejected_count"] if counts else 0,
            "mean_confidence": round(counts["avg_score"] or 0.0, 3) if counts else 0.0,
        },
        "terminology_lexicon": synonym_list,
        "historical_learned_links": [dict(r) for r in approved_matches],
    }
