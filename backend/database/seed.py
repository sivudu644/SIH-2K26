"""Seed data loader — populates the database with synthetic L5/L6 schedule activities."""

from __future__ import annotations

import csv
import logging
from pathlib import Path

from .connection import get_db, get_db_path

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def seed_schedule_from_csv(csv_path: Path | None = None) -> int:
    """Load schedule activities from the sample CSV into the database.
    
    Returns the number of activities inserted.
    """
    if csv_path is None:
        csv_path = DATA_DIR / "sample_schedule.csv"

    if not csv_path.exists():
        logger.warning("Seed CSV not found at %s — skipping.", csv_path)
        return 0

    count = 0
    with get_db() as conn:
        # Check if already seeded
        row = conn.execute("SELECT COUNT(*) as c FROM schedule_activities").fetchone()
        if row["c"] > 0:
            logger.info("Database already contains %d activities — skipping seed.", row["c"])
            return row["c"]

        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_data in reader:
                try:
                    conn.execute(
                        """INSERT OR IGNORE INTO schedule_activities
                           (activity_id, wbs, discipline, description,
                            planned_start, planned_finish, location, status, created_at)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
                        (
                            row_data.get("activity_id", "").strip(),
                            row_data.get("wbs", "").strip(),
                            row_data.get("discipline", "").strip().lower(),
                            row_data.get("description", "").strip(),
                            row_data.get("planned_start", "").strip(),
                            row_data.get("planned_finish", "").strip(),
                            row_data.get("location", "").strip(),
                            row_data.get("status", "not_started").strip().lower(),
                        ),
                    )
                    count += 1
                except Exception as exc:
                    logger.error("Error seeding row %s: %s", row_data, exc)

        conn.commit()
    logger.info("Seeded %d schedule activities from %s", count, csv_path)
    return count


def seed_if_empty() -> None:
    """Auto-seed the database on first startup if it's empty."""
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM schedule_activities").fetchone()
        if row["c"] == 0:
            logger.info("Empty database detected — running seed...")
            seed_schedule_from_csv()
