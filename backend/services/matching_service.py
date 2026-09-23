"""Matching service — multi-signal matching engine with confidence scoring & ambiguity detection."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime

from database.connection import get_db
from database.models import MatchCandidate, ReviewItem
from ai.provider import get_ai_provider
from ai.embeddings import (
    compute_similarity,
    compute_discipline_similarity,
    compute_location_similarity,
    compute_date_compatibility,
)
from ai.fallback import _tokenize, _expand_synonyms
from services.audit_service import AuditService
from config import settings

logger = logging.getLogger(__name__)

# Signal weights for multi-signal matching according to SIH 2K26 System Prompt
# 35% semantic description, 25% discipline, 20% token/id overlap, 10% location, 10% date compatibility
WEIGHTS = {
    "description": 0.35,
    "discipline": 0.25,
    "token": 0.20,
    "location": 0.10,
    "date": 0.10,
}

AMBIGUITY_THRESHOLD_DELTA = 0.08  # If top 2 candidate scores are within 8% and >= review threshold, flag as ambiguous


class MatchingService:
    """Multi-signal matching engine for linking progress events to schedule activities."""

    def __init__(self) -> None:
        self.ai_provider = get_ai_provider(settings.AI_PROVIDER)
        self.auto_threshold = settings.AUTO_MATCH_THRESHOLD
        self.review_threshold = settings.REVIEW_THRESHOLD

    def _build_corpus(self) -> None:
        """Build the AI provider corpus from all schedule activity descriptions."""
        with get_db() as conn:
            rows = conn.execute("SELECT description FROM schedule_activities").fetchall()
            descriptions = [r["description"] for r in rows]
            if hasattr(self.ai_provider, "build_corpus") and descriptions:
                self.ai_provider.build_corpus(descriptions)

    def _compute_token_and_id_similarity(self, event_desc: str, event_act_id: str | None, activity_id: str, act_desc: str) -> float:
        """Compute identifier & key token similarity with strict word boundary checks."""
        # 1. Exact Activity ID match from structured metadata
        if event_act_id and event_act_id.strip().lower() == activity_id.strip().lower():
            return 1.0
        
        # 2. Word boundary activity ID search in text (e.g. 'PIP-001' or 'PIP001')
        act_id_lower = activity_id.strip().lower()
        evt_lower = event_desc.lower()
        if re.search(r'\b' + re.escape(act_id_lower) + r'\b', evt_lower):
            return 1.0
        
        act_id_clean = act_id_lower.replace("-", "")
        if len(act_id_clean) >= 4 and re.search(r'\b' + re.escape(act_id_clean) + r'\b', evt_lower.replace("-", "")):
            return 1.0

        # 3. Token overlap with synonym expansion
        tokens_a = set(_expand_synonyms(_tokenize(event_desc)))
        tokens_b = set(_expand_synonyms(_tokenize(act_desc)))
        
        if not tokens_a or not tokens_b:
            return 0.2
        
        intersection = tokens_a & tokens_b
        union = tokens_a | tokens_b
        jaccard = len(intersection) / len(union) if union else 0.0
        
        # If multiple core domain terms overlap, reward significantly
        if len(intersection) >= 3:
            return max(0.9, jaccard * 1.5)
        elif len(intersection) >= 2:
            return max(0.75, jaccard * 1.3)
        elif len(intersection) == 1:
            return max(0.5, jaccard)
        return jaccard

    def run_matching(self) -> dict:
        """Run matching for all unmatched progress events against schedule activities."""
        self._build_corpus()

        with get_db() as conn:
            events = [dict(e) for e in conn.execute(
                "SELECT * FROM progress_events WHERE status IN ('extracted', 'unmatched', 'review')"
            ).fetchall()]

            activities = [dict(a) for a in conn.execute(
                "SELECT * FROM schedule_activities"
            ).fetchall()]

        if not events:
            logger.info("No unmatched events to process.")
            return {"total_events": 0, "auto_matched": 0, "review_required": 0, "unmatched": 0}

        if not activities:
            logger.warning("No schedule activities in database.")
            return {"total_events": len(events), "auto_matched": 0, "review_required": 0, "unmatched": len(events)}

        auto_matched = 0
        review_required = 0
        unmatched = 0

        for event in events:
            event_desc = event.get("normalized_description") or event.get("raw_text") or ""
            event_act_id = event.get("activity_id")

            # Clean previous pending match candidates and pending review items for this event
            with get_db() as conn:
                conn.execute(
                    "DELETE FROM match_candidates WHERE event_id = ? AND status = 'pending'",
                    (event["event_id"],),
                )
                conn.execute(
                    "DELETE FROM review_items WHERE event_id = ? AND status = 'pending'",
                    (event["event_id"],),
                )

            all_candidates = []

            for activity in activities:
                # 1. Semantic description similarity
                desc_sim = compute_similarity(event_desc, activity["description"])
                
                # 2. Discipline match
                disc_sim = compute_discipline_similarity(
                    event.get("discipline"),
                    activity.get("discipline"),
                )
                
                # 3. Identifier / Token similarity
                token_sim = self._compute_token_and_id_similarity(
                    event_desc,
                    event_act_id,
                    activity["activity_id"],
                    activity["description"],
                )
                
                # 4. Location similarity
                loc_sim = compute_location_similarity(
                    event.get("location"),
                    activity.get("location"),
                )
                
                # 5. Date compatibility
                date_compat = compute_date_compatibility(
                    event.get("actual_start"),
                    activity.get("planned_start"),
                    activity.get("planned_finish"),
                )

                # Multi-signal weighted score
                final_score = (
                    WEIGHTS["description"] * desc_sim
                    + WEIGHTS["discipline"] * disc_sim
                    + WEIGHTS["token"] * token_sim
                    + WEIGHTS["location"] * loc_sim
                    + WEIGHTS["date"] * date_compat
                )

                candidate = {
                    "activity_id": activity["activity_id"],
                    "activity_description": activity["description"],
                    "similarity_score": round(desc_sim, 4),
                    "confidence_score": round(final_score, 4),
                    "description_similarity": round(desc_sim, 4),
                    "discipline_similarity": round(disc_sim, 4),
                    "token_similarity": round(token_sim, 4),
                    "location_similarity": round(loc_sim, 4),
                    "date_compatibility": round(date_compat, 4),
                }
                all_candidates.append(candidate)

            all_candidates.sort(key=lambda x: x["confidence_score"], reverse=True)
            best_match = all_candidates[0] if all_candidates else None
            second_match = all_candidates[1] if len(all_candidates) > 1 else None

            best_score = best_match["confidence_score"] if best_match else 0.0
            second_score = second_match["confidence_score"] if second_match else 0.0

            if best_match is None or best_score < 0.30:
                unmatched += 1
                self._update_event_status(event["event_id"], "unmatched", confidence=best_score)
                continue

            # Ambiguity Check: If top 2 candidate scores are within 8% and both above review threshold
            is_ambiguous = False
            if second_match and second_score >= self.review_threshold and round(best_score - second_score, 2) <= AMBIGUITY_THRESHOLD_DELTA:
                is_ambiguous = True

            explanation = self.ai_provider.generate_explanation(
                event_desc,
                best_match["activity_description"],
                best_score,
            )

            if is_ambiguous:
                explanation = (
                    f"Ambiguity Warning (Δ={round((best_score - second_score)*100, 1)}%): "
                    f"Close match with both [{best_match['activity_id']}] ({round(best_score*100, 1)}%) "
                    f"and [{second_match['activity_id']}] ({round(second_score*100, 1)}%). "
                    f"Routed to Human-in-the-Loop Review Queue for confirmation. " + explanation
                )

            match_id = str(uuid.uuid4())
            if best_score >= self.auto_threshold and not is_ambiguous:
                status = "auto_matched"
                auto_matched += 1
                self._update_event_status(
                    event["event_id"], "matched",
                    activity_id=best_match["activity_id"],
                    confidence=best_score,
                )
            elif best_score >= self.review_threshold or is_ambiguous:
                status = "pending"
                review_required += 1
                self._update_event_status(
                    event["event_id"], "review",
                    activity_id=best_match["activity_id"],
                    confidence=best_score,
                )
                self._create_review_item(
                    event_id=event["event_id"],
                    match_id=match_id,
                    event_description=event_desc,
                    activity_description=best_match["activity_description"],
                    activity_id=best_match["activity_id"],
                    confidence=best_score,
                    alternative_activity_id=second_match["activity_id"] if second_match else None,
                    alternative_activity_desc=second_match["activity_description"] if second_match else None,
                    alternative_confidence=second_score if second_match else None,
                    is_ambiguous=is_ambiguous,
                )
            else:
                status = "pending"
                unmatched += 1
                self._update_event_status(event["event_id"], "unmatched", confidence=best_score)

            self._store_match_candidate(
                match_id=match_id,
                event_id=event["event_id"],
                candidate=best_match,
                explanation=explanation,
                status=status,
                is_ambiguous=is_ambiguous,
            )

        result = {
            "total_events": len(events),
            "auto_matched": auto_matched,
            "review_required": review_required,
            "unmatched": unmatched,
        }

        AuditService.log(
            action="matching_run",
            entity_type="matching",
            details=f"Processed {len(events)} events: {auto_matched} auto-matched (≥0.85), "
                    f"{review_required} review queue (0.65-0.84 or ambiguous), {unmatched} unmatched (<0.65)",
        )

        logger.info("Matching complete: %s", result)
        return result

    def _update_event_status(
        self, event_id: str, status: str,
        activity_id: str | None = None, confidence: float | None = None,
    ) -> None:
        with get_db() as conn:
            if activity_id:
                conn.execute(
                    "UPDATE progress_events SET status = ?, activity_id = ?, confidence = ? WHERE event_id = ?",
                    (status, activity_id, confidence, event_id),
                )
            elif confidence is not None:
                conn.execute(
                    "UPDATE progress_events SET status = ?, confidence = ? WHERE event_id = ?",
                    (status, confidence, event_id),
                )
            else:
                conn.execute(
                    "UPDATE progress_events SET status = ? WHERE event_id = ?",
                    (status, event_id),
                )

    def _store_match_candidate(
        self, match_id: str, event_id: str, candidate: dict,
        explanation: str, status: str, is_ambiguous: bool = False,
    ) -> None:
        with get_db() as conn:
            conn.execute(
                """INSERT INTO match_candidates
                   (match_id, event_id, activity_id, similarity_score, confidence_score,
                    description_similarity, discipline_similarity, token_similarity,
                    location_similarity, date_compatibility, is_ambiguous, explanation, status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    match_id,
                    event_id,
                    candidate["activity_id"],
                    candidate["similarity_score"],
                    candidate["confidence_score"],
                    candidate["description_similarity"],
                    candidate["discipline_similarity"],
                    candidate["token_similarity"],
                    candidate["location_similarity"],
                    candidate["date_compatibility"],
                    1 if is_ambiguous else 0,
                    explanation,
                    status,
                    datetime.now().isoformat(),
                ),
            )

    def _create_review_item(
        self, event_id: str, match_id: str,
        event_description: str, activity_description: str,
        activity_id: str, confidence: float,
        alternative_activity_id: str | None = None,
        alternative_activity_desc: str | None = None,
        alternative_confidence: float | None = None,
        is_ambiguous: bool = False,
    ) -> None:
        with get_db() as conn:
            existing = conn.execute("SELECT review_id FROM review_items WHERE event_id = ? AND status = 'pending'", (event_id,)).fetchone()
            now = datetime.now().isoformat()
            if existing:
                conn.execute(
                    """UPDATE review_items 
                       SET match_id = ?, confidence = ?, activity_id = ?, activity_description = ?,
                           alternative_activity_id = ?, alternative_activity_desc = ?, 
                           alternative_confidence = ?, is_ambiguous = ?
                       WHERE review_id = ?""",
                    (
                        match_id, confidence, activity_id, activity_description,
                        alternative_activity_id, alternative_activity_desc, alternative_confidence,
                        1 if is_ambiguous else 0, existing["review_id"]
                    ),
                )
            else:
                conn.execute(
                    """INSERT INTO review_items
                       (review_id, event_id, match_id, event_description,
                        activity_description, activity_id, confidence, 
                        alternative_activity_id, alternative_activity_desc, alternative_confidence,
                        is_ambiguous, status, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                    (
                        str(uuid.uuid4()),
                        event_id,
                        match_id,
                        event_description,
                        activity_description,
                        activity_id,
                        confidence,
                        alternative_activity_id,
                        alternative_activity_desc,
                        alternative_confidence,
                        1 if is_ambiguous else 0,
                        now,
                    ),
                )

    @staticmethod
    def get_review_items() -> list[dict]:
        with get_db() as conn:
            rows = conn.execute(
                """SELECT r.*, 
                          COALESCE(m.explanation, '') as explanation,
                          m.description_similarity,
                          m.discipline_similarity,
                          m.token_similarity,
                          m.location_similarity,
                          m.date_compatibility
                   FROM review_items r
                   LEFT JOIN match_candidates m ON (r.match_id = m.match_id OR r.event_id = m.event_id)
                   WHERE r.status = 'pending'
                   ORDER BY r.confidence DESC"""
            ).fetchall()
            return [dict(r) for r in rows]

    @staticmethod
    def approve_match(match_id: str, reviewer_notes: str | None = None, chosen_activity_id: str | None = None) -> bool:
        with get_db() as conn:
            # 1. Lookup in match_candidates
            match = conn.execute(
                "SELECT * FROM match_candidates WHERE match_id = ?", (match_id,)
            ).fetchone()

            # 2. Fallback: lookup in review_items (by match_id or review_id)
            review = None
            if not match:
                review = conn.execute(
                    "SELECT * FROM review_items WHERE match_id = ? OR review_id = ?", (match_id, match_id)
                ).fetchone()
                if review:
                    match = conn.execute(
                        "SELECT * FROM match_candidates WHERE event_id = ? ORDER BY id DESC",
                        (review["event_id"],)
                    ).fetchone()

            if not match and not review:
                return False

            now = datetime.now().isoformat()
            event_id = match["event_id"] if match else review["event_id"]
            confidence = match["confidence_score"] if match else (review["confidence"] if review else 0.85)
            default_act_id = match["activity_id"] if match else (review["activity_id"] if review else "")
            target_act_id = chosen_activity_id or default_act_id
            actual_match_id = match["match_id"] if match else (review["match_id"] if review and review["match_id"] else match_id)

            # Update match candidates
            conn.execute(
                """UPDATE match_candidates 
                   SET status = 'approved', activity_id = ?, reviewed_by = 'user', reviewed_at = ? 
                   WHERE match_id = ? OR event_id = ?""",
                (target_act_id, now, actual_match_id, event_id),
            )

            # Update progress events
            conn.execute(
                "UPDATE progress_events SET status = 'approved', activity_id = ?, confidence = ? WHERE event_id = ?",
                (target_act_id, confidence, event_id),
            )

            # Update review items
            conn.execute(
                """UPDATE review_items 
                   SET status = 'approved', activity_id = ?, reviewer_notes = ?, reviewed_at = ? 
                   WHERE match_id = ? OR review_id = ? OR event_id = ?""",
                (target_act_id, reviewer_notes, now, actual_match_id, match_id, event_id),
            )

            # Update schedule activity status according to existing business logic
            evt = conn.execute("SELECT event_type FROM progress_events WHERE event_id = ?", (event_id,)).fetchone()
            if evt and evt["event_type"] == "completion":
                conn.execute("UPDATE schedule_activities SET status = 'completed' WHERE activity_id = ?", (target_act_id,))
            else:
                conn.execute(
                    "UPDATE schedule_activities SET status = 'in_progress' WHERE activity_id = ? AND status = 'not_started'",
                    (target_act_id,),
                )

        # Audit logging outside with get_db() to ensure clean transaction commit without lock contention
        AuditService.log(
            action="match_approved",
            entity_type="match",
            entity_id=actual_match_id,
            details=f"Event {event_id} matched to activity {target_act_id}. Notes: {reviewer_notes or 'none'}",
            user="reviewer",
        )
        return True

    @staticmethod
    def reject_match(match_id: str, reviewer_notes: str | None = None) -> bool:
        with get_db() as conn:
            # 1. Lookup in match_candidates
            match = conn.execute(
                "SELECT * FROM match_candidates WHERE match_id = ?", (match_id,)
            ).fetchone()

            # 2. Fallback: lookup in review_items (by match_id or review_id)
            review = None
            if not match:
                review = conn.execute(
                    "SELECT * FROM review_items WHERE match_id = ? OR review_id = ?", (match_id, match_id)
                ).fetchone()
                if review:
                    match = conn.execute(
                        "SELECT * FROM match_candidates WHERE event_id = ? ORDER BY id DESC",
                        (review["event_id"],)
                    ).fetchone()

            if not match and not review:
                return False

            now = datetime.now().isoformat()
            event_id = match["event_id"] if match else review["event_id"]
            actual_match_id = match["match_id"] if match else (review["match_id"] if review and review["match_id"] else match_id)

            # Update match candidates
            conn.execute(
                """UPDATE match_candidates 
                   SET status = 'rejected', reviewed_by = 'user', reviewed_at = ? 
                   WHERE match_id = ? OR event_id = ?""",
                (now, actual_match_id, event_id),
            )

            # Reset progress event to unmatched
            conn.execute(
                "UPDATE progress_events SET status = 'unmatched', activity_id = NULL WHERE event_id = ?",
                (event_id,),
            )

            # Update review items
            conn.execute(
                """UPDATE review_items 
                   SET status = 'rejected', reviewer_notes = ?, reviewed_at = ? 
                   WHERE match_id = ? OR review_id = ? OR event_id = ?""",
                (reviewer_notes, now, actual_match_id, match_id, event_id),
            )

        # Audit logging outside with get_db() to ensure clean transaction commit without lock contention
        AuditService.log(
            action="match_rejected",
            entity_type="match",
            entity_id=actual_match_id,
            details=f"Match rejected for event {event_id}. Notes: {reviewer_notes or 'none'}",
            user="reviewer",
        )
        return True

    @staticmethod
    def get_match_candidates(event_id: str | None = None) -> list[dict]:
        with get_db() as conn:
            if event_id:
                rows = conn.execute(
                    "SELECT * FROM match_candidates WHERE event_id = ? ORDER BY confidence_score DESC",
                    (event_id,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM match_candidates ORDER BY confidence_score DESC"
                ).fetchall()
            return [dict(r) for r in rows]
