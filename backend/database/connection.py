"""SQLite database connection manager with auto-migration."""

from __future__ import annotations

import logging
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from .models import TABLE_DEFINITIONS

logger = logging.getLogger(__name__)

# Default DB path: project_root/database/sih.db
_DB_DIR = Path(__file__).resolve().parent.parent.parent / "database"
_DB_PATH = _DB_DIR / "sih.db"


def get_db_path() -> Path:
    """Return the resolved database file path, creating the directory if needed."""
    env_path = os.getenv("SIH_DB_PATH")
    if env_path:
        db_path = Path(env_path)
    else:
        db_path = _DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection(db_path: Path | None = None) -> sqlite3.Connection:
    """Create a new SQLite connection with row factory."""
    if db_path is None:
        db_path = get_db_path()
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db(db_path: Path | None = None) -> Generator[sqlite3.Connection, None, None]:
    """Context-managed database connection."""
    conn = get_connection(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _run_migrations(conn: sqlite3.Connection) -> None:
    """Run lightweight non-destructive schema migrations."""
    # Ensure review_items has alternative candidate columns & is_ambiguous
    review_cols = [r["name"] for r in conn.execute("PRAGMA table_info(review_items)").fetchall()]
    if review_cols:
        if "alternative_activity_id" not in review_cols:
            conn.execute("ALTER TABLE review_items ADD COLUMN alternative_activity_id TEXT")
        if "alternative_activity_desc" not in review_cols:
            conn.execute("ALTER TABLE review_items ADD COLUMN alternative_activity_desc TEXT")
        if "alternative_confidence" not in review_cols:
            conn.execute("ALTER TABLE review_items ADD COLUMN alternative_confidence REAL")
        if "is_ambiguous" not in review_cols:
            conn.execute("ALTER TABLE review_items ADD COLUMN is_ambiguous INTEGER DEFAULT 0")

    match_cols = [r["name"] for r in conn.execute("PRAGMA table_info(match_candidates)").fetchall()]
    if match_cols:
        if "is_ambiguous" not in match_cols:
            conn.execute("ALTER TABLE match_candidates ADD COLUMN is_ambiguous INTEGER DEFAULT 0")


def init_db(db_path: Path | None = None) -> None:
    """Initialize database — create all tables if they don't exist and run migrations."""
    if db_path is None:
        db_path = get_db_path()
    logger.info("Initializing database at %s", db_path)
    conn = get_connection(db_path)
    try:
        conn.executescript(TABLE_DEFINITIONS)
        _run_migrations(conn)
        conn.commit()
        logger.info("Database tables created/verified successfully.")
    finally:
        conn.close()


def reset_db(db_path: Path | None = None) -> None:
    """Drop and re-create all tables. Used for testing."""
    if db_path is None:
        db_path = get_db_path()
    tables = [
        "audit_log",
        "review_items",
        "match_candidates",
        "documents",
        "progress_events",
        "schedule_activities",
        "projects",
    ]
    conn = get_connection(db_path)
    try:
        for table in tables:
            conn.execute(f"DROP TABLE IF EXISTS {table}")
        conn.commit()
        conn.executescript(TABLE_DEFINITIONS)
        _run_migrations(conn)
        conn.commit()
        logger.info("Database reset completed.")
    finally:
        conn.close()
