"""Matching router — endpoints for running matching and managing reviews."""

from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException

from database.models import MatchRunResponse, ReviewAction
from services.matching_service import MatchingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/matching", tags=["Matching"])


@router.post("/run", response_model=MatchRunResponse)
async def run_matching():
    """Run the matching engine on all unmatched progress events."""
    try:
        service = MatchingService()
        result = service.run_matching()
        return MatchRunResponse(
            message="Matching completed successfully.",
            total_events=result["total_events"],
            auto_matched=result["auto_matched"],
            review_required=result["review_required"],
            unmatched=result["unmatched"],
        )
    except Exception as exc:
        logger.error("Matching failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(exc)}")


@router.get("/review")
async def get_review_queue():
    """Get all pending review items."""
    try:
        items = MatchingService.get_review_items()
        return {"review_items": items, "count": len(items)}
    except Exception as exc:
        logger.error("Failed to fetch review queue: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/review/{match_id}/approve")
@router.post("/{match_id}/approve")
async def approve_match(match_id: str, body: Optional[ReviewAction] = None):
    """Approve a match candidate, optionally selecting an alternative candidate."""
    try:
        notes = body.reviewer_notes if body else None
        chosen_act = body.chosen_activity_id if body else None
        success = MatchingService.approve_match(match_id, notes, chosen_act)
        if not success:
            raise HTTPException(status_code=404, detail=f"Match {match_id} not found.")
        return {"message": "Match approved successfully.", "match_id": match_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Approve failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/review/{match_id}/reject")
@router.post("/{match_id}/reject")
async def reject_match(match_id: str, body: Optional[ReviewAction] = None):
    """Reject a match candidate."""
    try:
        notes = body.reviewer_notes if body else None
        success = MatchingService.reject_match(match_id, notes)
        if not success:
            raise HTTPException(status_code=404, detail=f"Match {match_id} not found.")
        return {"message": "Match rejected.", "match_id": match_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Reject failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
