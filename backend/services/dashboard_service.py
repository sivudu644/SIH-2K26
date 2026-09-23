"""Dashboard service — aggregates data from all tables for dashboard visualization & variance analysis."""

from __future__ import annotations

import logging
from datetime import datetime
from database.connection import get_db
from database.models import DashboardData

logger = logging.getLogger(__name__)


def _parse_date(d: str | None) -> datetime | None:
    if not d:
        return None
    # Extract just YYYY-MM-DD
    clean_d = d.strip().split()[0]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%d-%b-%Y"):
        try:
            return datetime.strptime(clean_d, fmt)
        except ValueError:
            continue
    return None


class DashboardService:
    """Aggregates data for the dashboard — all values come directly from SQLite database."""

    @staticmethod
    def get_dashboard_data() -> dict:
        """Build complete dashboard data from database queries with schedule variance calculations."""
        with get_db() as conn:
            # Total activities
            total_activities = conn.execute(
                "SELECT COUNT(*) as c FROM schedule_activities"
            ).fetchone()["c"]

            # Total events
            total_events = conn.execute(
                "SELECT COUNT(*) as c FROM progress_events"
            ).fetchone()["c"]

            # Matched events (approved + auto_matched + matched)
            matched_events = conn.execute(
                "SELECT COUNT(*) as c FROM progress_events WHERE status IN ('matched', 'approved')"
            ).fetchone()["c"]

            # Average confidence (of all events with confidence)
            avg_row = conn.execute(
                "SELECT AVG(confidence) as avg_c FROM progress_events WHERE confidence IS NOT NULL"
            ).fetchone()
            avg_confidence = round(avg_row["avg_c"] or 0.0, 2)

            # Review queue count
            review_queue_count = conn.execute(
                "SELECT COUNT(*) as c FROM review_items WHERE status = 'pending'"
            ).fetchone()["c"]

            # Unmatched count
            unmatched_count = conn.execute(
                "SELECT COUNT(*) as c FROM progress_events WHERE status = 'unmatched'"
            ).fetchone()["c"]

            # Discipline-wise progress
            discipline_rows = conn.execute(
                """SELECT
                     sa.discipline,
                     COUNT(DISTINCT sa.activity_id) as total_activities,
                     COUNT(DISTINCT CASE WHEN pe.status IN ('matched', 'approved') THEN pe.event_id END) as matched_events,
                     COUNT(DISTINCT pe.event_id) as total_events
                   FROM schedule_activities sa
                   LEFT JOIN progress_events pe ON pe.activity_id = sa.activity_id
                   GROUP BY sa.discipline
                   ORDER BY sa.discipline"""
            ).fetchall()
            discipline_progress = [
                {
                    "discipline": r["discipline"].capitalize(),
                    "total_activities": r["total_activities"],
                    "matched_events": r["matched_events"],
                    "total_events": r["total_events"],
                    "progress_pct": round(
                        (r["matched_events"] / r["total_activities"] * 100) if r["total_activities"] > 0 else 0, 1
                    ),
                }
                for r in discipline_rows
            ]

            # Confidence distribution
            confidence_buckets = [
                {"range": "High (≥0.85)", "min": 0.85, "max": 1.01},
                {"range": "Medium (0.65-0.84)", "min": 0.65, "max": 0.85},
                {"range": "Low (<0.65)", "min": 0.0, "max": 0.65},
            ]
            confidence_distribution = []
            for bucket in confidence_buckets:
                count = conn.execute(
                    "SELECT COUNT(*) as c FROM progress_events WHERE confidence >= ? AND confidence < ?",
                    (bucket["min"], bucket["max"]),
                ).fetchone()["c"]
                confidence_distribution.append({"range": bucket["range"], "count": count})

            # Planned vs actual data with grouping & schedule variance computation
            planned_vs_actual = conn.execute(
                """SELECT
                     sa.activity_id,
                     sa.description,
                     sa.discipline,
                     sa.planned_start,
                     sa.planned_finish,
                     sa.status as schedule_status,
                     MIN(pe.actual_start) as actual_start,
                     MAX(pe.actual_finish) as actual_finish,
                     COUNT(pe.event_id) as linked_events_count
                   FROM schedule_activities sa
                   LEFT JOIN progress_events pe ON pe.activity_id = sa.activity_id AND pe.status IN ('matched', 'approved')
                   GROUP BY sa.activity_id
                   ORDER BY sa.wbs, sa.activity_id"""
            ).fetchall()

            planned_vs_actual_list = []
            for r in planned_vs_actual:
                row_dict = dict(r)
                p_start = _parse_date(row_dict.get("planned_start"))
                a_start = _parse_date(row_dict.get("actual_start"))
                
                variance_str = "On Track"
                variance_days = 0
                if p_start and a_start:
                    variance_days = (a_start - p_start).days
                    if variance_days > 0:
                        variance_str = f"+{variance_days}d Delay"
                    elif variance_days < 0:
                        variance_str = f"{variance_days}d Early"
                    else:
                        variance_str = "On Schedule"
                elif row_dict.get("schedule_status") == "completed":
                    variance_str = "Completed"
                elif not a_start:
                    variance_str = "Pending Start"

                row_dict["variance"] = variance_str
                row_dict["variance_days"] = variance_days
                planned_vs_actual_list.append(row_dict)

            # Recent audit events
            recent_audits = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 15"
            ).fetchall()
            recent_audits_list = [dict(r) for r in recent_audits]

        return {
            "total_activities": total_activities,
            "total_events": total_events,
            "matched_events": matched_events,
            "avg_confidence": avg_confidence,
            "review_queue_count": review_queue_count,
            "unmatched_count": unmatched_count,
            "discipline_progress": discipline_progress,
            "confidence_distribution": confidence_distribution,
            "recent_audits": recent_audits_list,
            "planned_vs_actual": planned_vs_actual_list,
        }
