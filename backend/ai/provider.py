"""AI provider abstraction — interface for LLM and embedding providers."""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Abstract base class for AI providers (LLM + embeddings)."""

    @abstractmethod
    def get_embedding(self, text: str) -> list[float]:
        """Generate an embedding vector for the given text."""
        ...

    @abstractmethod
    def compute_similarity(self, text_a: str, text_b: str) -> float:
        """Compute semantic similarity between two texts. Returns 0.0–1.0."""
        ...

    @abstractmethod
    def extract_events(self, text: str) -> list[dict]:
        """Extract structured events from unstructured text."""
        ...

    @abstractmethod
    def generate_explanation(self, event_desc: str, activity_desc: str, score: float) -> str:
        """Generate a human-readable explanation for a match."""
        ...


def get_ai_provider(provider_name: str = "fallback") -> AIProvider:
    """Factory function to get the appropriate AI provider.

    Args:
        provider_name: "fallback" (default), "openai", or "gemini"

    Returns:
        An AIProvider instance.
    """
    if provider_name == "fallback":
        from .fallback import FallbackAIProvider
        return FallbackAIProvider()
    elif provider_name == "openai":
        # Future: implement OpenAI provider
        logger.warning("OpenAI provider not implemented — falling back to deterministic provider.")
        from .fallback import FallbackAIProvider
        return FallbackAIProvider()
    elif provider_name == "gemini":
        # Future: implement Gemini provider
        logger.warning("Gemini provider not implemented — falling back to deterministic provider.")
        from .fallback import FallbackAIProvider
        return FallbackAIProvider()
    else:
        logger.warning("Unknown provider '%s' — using fallback.", provider_name)
        from .fallback import FallbackAIProvider
        return FallbackAIProvider()
