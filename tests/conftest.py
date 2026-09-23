"""Pytest configuration and shared fixtures."""

import os
import sys
from pathlib import Path
import pytest

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from database.connection import init_db, reset_db, get_db_path
from database.seed import seed_schedule_from_csv


@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    """Provide a clean, isolated SQLite database for each test run."""
    test_db = tmp_path / "test_sih.db"
    monkeypatch.setenv("SIH_DB_PATH", str(test_db))
    monkeypatch.setenv("SIH_AI_PROVIDER", "fallback")
    
    init_db(test_db)
    yield test_db
    # Cleanup if needed
