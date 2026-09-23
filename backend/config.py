"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path


class Settings:
    """Central configuration — reads from env vars with sensible defaults."""

    # Server
    HOST: str = os.getenv("SIH_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("SIH_PORT", "8000"))
    DEBUG: bool = os.getenv("SIH_DEBUG", "true").lower() == "true"

    # Database
    DB_PATH: str = os.getenv(
        "SIH_DB_PATH",
        str(Path(__file__).resolve().parent.parent / "database" / "sih.db"),
    )

    # AI / LLM
    AI_PROVIDER: str = os.getenv("SIH_AI_PROVIDER", "fallback")  # "fallback" | "openai" | "gemini"
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Matching thresholds
    AUTO_MATCH_THRESHOLD: float = float(os.getenv("SIH_AUTO_MATCH", "0.85"))
    REVIEW_THRESHOLD: float = float(os.getenv("SIH_REVIEW_THRESHOLD", "0.65"))

    # Paths
    PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = PROJECT_ROOT / "data"
    UPLOAD_DIR: Path = PROJECT_ROOT / "uploads"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


settings = Settings()

# Ensure runtime directories exist
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
