"""Main FastAPI application entry point for SIH26122 Intelligent Data Capture & Schedule-Linking Layer."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database.connection import init_db
from database.seed import seed_if_empty
from routers.schedule import router as schedule_router
from routers.progress import router as progress_router
from routers.matching import router as matching_router, approve_match, reject_match
from routers.dashboard import router as dashboard_router
from routers.audit import router as audit_router
from routers.agent import agent_router, memory_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sih-backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    logger.info("Starting up SIH26122 Schedule-Linking Backend...")
    # Initialize DB tables
    init_db()
    # Seed baseline data if database is new
    seed_if_empty()
    logger.info("Application initialized in DEMO MODE (Deterministic Fallback AI Provider).")
    yield
    logger.info("Shutting down SIH26122 Backend.")


app = FastAPI(
    title="InfraSync AI",
    description="Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Controls.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for React Vite frontend (supports localhost and Render domains)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all endpoint routers
app.include_router(schedule_router)
app.include_router(progress_router)
app.include_router(matching_router)
app.include_router(dashboard_router)
app.include_router(audit_router)
app.include_router(agent_router)
app.include_router(memory_router)

# Review alias router for /api/v1/reviews/{id}/approve and /reject
reviews_router = APIRouter(prefix="/api/v1/reviews", tags=["Reviews"])
reviews_router.add_api_route("/{match_id}/approve", approve_match, methods=["POST"])
reviews_router.add_api_route("/{match_id}/reject", reject_match, methods=["POST"])
app.include_router(reviews_router)


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint directing visitors to documentation."""
    return {
        "message": "SIH26122 - InfraSync AI Backend API is running successfully.",
        "service": "InfraSync AI",
        "documentation": "/docs",
        "health": "/health",
        "mode": "DEMO MODE",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "InfraSync AI",
        "mode": "DEMO MODE",
        "ai_provider": settings.AI_PROVIDER,
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main.py:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
