"""AI package — provider abstraction, embeddings, and deterministic fallback."""

from .provider import AIProvider, get_ai_provider
from .fallback import FallbackAIProvider
from .embeddings import compute_similarity, get_embeddings

__all__ = [
    "AIProvider",
    "get_ai_provider",
    "FallbackAIProvider",
    "compute_similarity",
    "get_embeddings",
]
