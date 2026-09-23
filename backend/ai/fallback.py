"""Deterministic fallback AI provider — TF-IDF, token overlap, fuzzy matching.

Works without any external API keys. This is the default DEMO MODE provider.
"""

from __future__ import annotations

import logging
import math
import re
from collections import Counter
from difflib import SequenceMatcher
from typing import Optional

from .provider import AIProvider

logger = logging.getLogger(__name__)

# Domain-specific synonyms for infrastructure projects
SYNONYMS = {
    "rcc": "reinforced concrete",
    "rc": "reinforced concrete",
    "ss": "stainless steel",
    "cs": "carbon steel",
    "ms": "mild steel",
    "gi": "galvanized iron",
    "ht": "high tension",
    "lt": "low tension",
    "mcc": "motor control center",
    "vfd": "variable frequency drive",
    "dg": "diesel generator",
    "jb": "junction box",
    "ndt": "non destructive testing",
    "rt": "radiography testing",
    "cum": "cubic meter",
    "sqm": "square meter",
    "rm": "running meter",
    "nos": "numbers",
    "pcc": "plain cement concrete",
    "erection": "installation",
    "laying": "installation",
    "pulling": "installation",
    "earthing": "grounding",
    "earth grid": "grounding grid",
    "earthwork": "excavation",
    "earth moving": "earthwork excavation",
    "earth removal": "earthwork excavation",
    "bolting": "bolt-up",
    "welding": "weld joint",
    "spool": "pipe spool",
    "spools": "pipe spool",
    "fabrication": "spool fabrication",
    "hydro test": "hydrostatic pressure testing",
    "hydrotest": "hydrostatic pressure testing",
    "piling": "piling work heavy equipment",
    "driven pile": "piling work heavy equipment",
    "driven piles": "piling work heavy equipment",
    "cable tray": "cable tray and ladder",
    "cable trays": "cable tray and ladder",
    "ladder rack": "cable tray and ladder",
    "ladder racks": "cable tray and ladder",
    "pedestal": "pedestal construction",
    "pedestals": "pedestal construction",
    "trench": "cable trench construction",
    "grading": "road and access way",
    "concreting": "concrete pouring foundation",
    "grouting": "equipment foundation grouting",
    "shuttering": "formwork shuttering reinforcement",
    "formwork": "formwork shuttering reinforcement",
    "rebar": "reinforced concrete steel bar",
    "reinforcement": "reinforced concrete steel",
    "transformer": "main power transformer installation",
    "switchgear": "substation bus bar switchgear",
    "bus bar": "substation bus bar switchgear",
    "lighting": "lighting installation process area",
    "firewater": "utility piping firewater",
    "drainage": "storm water drainage system",
}

STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "shall", "can", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "out", "off", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "no", "not", "only", "own", "same",
    "so", "than", "too", "very", "just", "and", "but", "or", "nor", "if",
    "about", "up", "it", "its", "this", "that", "these", "those", "work", "area",
}


def _tokenize(text: str) -> list[str]:
    """Tokenize text into lowercase words, removing stop words."""
    tokens = re.findall(r"[a-z0-9]+(?:[-/][a-z0-9]+)*", text.lower())
    return [t for t in tokens if t not in STOP_WORDS and len(t) > 1]


def _expand_synonyms(tokens: list[str]) -> list[str]:
    """Expand tokens using domain synonyms."""
    expanded = list(tokens)
    text_joined = " ".join(tokens)
    for key, syn_val in SYNONYMS.items():
        if key in text_joined or key in tokens:
            syn_tokens = _tokenize(syn_val)
            expanded.extend(syn_tokens)
    return expanded


def _compute_tf(tokens: list[str]) -> dict[str, float]:
    """Compute term frequency."""
    counter = Counter(tokens)
    total = len(tokens) if tokens else 1
    return {term: count / total for term, count in counter.items()}


def _cosine_similarity(vec_a: dict[str, float], vec_b: dict[str, float]) -> float:
    """Compute cosine similarity between two sparse vectors."""
    if not vec_a or not vec_b:
        return 0.0
    all_terms = set(vec_a.keys()) | set(vec_b.keys())
    dot = sum(vec_a.get(t, 0) * vec_b.get(t, 0) for t in all_terms)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))
    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


class FallbackAIProvider(AIProvider):
    """Deterministic AI provider using TF-IDF, Jaccard, and fuzzy matching."""

    def __init__(self) -> None:
        self._idf_cache: dict[str, float] = {}
        self._corpus: list[list[str]] = []
        logger.info("Initialized FallbackAIProvider (DEMO MODE — no API key required).")

    def build_corpus(self, documents: list[str]) -> None:
        """Build IDF weights from a corpus of documents."""
        self._corpus = [_expand_synonyms(_tokenize(doc)) for doc in documents]
        all_tokens: set[str] = set()
        for tokens in self._corpus:
            all_tokens.update(tokens)

        n_docs = len(self._corpus) if self._corpus else 1
        for token in all_tokens:
            doc_count = sum(1 for tokens in self._corpus if token in tokens)
            self._idf_cache[token] = math.log(n_docs / (1 + doc_count)) + 1.0

    def get_embedding(self, text: str) -> list[float]:
        """Generate a TF-IDF-weighted vector."""
        tokens = _expand_synonyms(_tokenize(text))
        tf = _compute_tf(tokens)
        all_terms = sorted(set(list(tf.keys()) + list(self._idf_cache.keys())))
        if not all_terms:
            return [0.0]
        return [tf.get(t, 0) * self._idf_cache.get(t, 1.0) for t in all_terms]

    def compute_similarity(self, text_a: str, text_b: str) -> float:
        """Compute similarity using multiple signals combined."""
        tokens_a = _expand_synonyms(_tokenize(text_a))
        tokens_b = _expand_synonyms(_tokenize(text_b))

        tf_a = _compute_tf(tokens_a)
        tf_b = _compute_tf(tokens_b)
        tfidf_a = {t: v * self._idf_cache.get(t, 1.0) for t, v in tf_a.items()}
        tfidf_b = {t: v * self._idf_cache.get(t, 1.0) for t, v in tf_b.items()}
        cosine = _cosine_similarity(tfidf_a, tfidf_b)

        set_a, set_b = set(tokens_a), set(tokens_b)
        if set_a or set_b:
            jaccard = len(set_a & set_b) / len(set_a | set_b)
        else:
            jaccard = 0.0

        fuzzy = SequenceMatcher(None, " ".join(tokens_a), " ".join(tokens_b)).ratio()

        # High-overlap bonus if key core nouns match
        overlap_count = len(set_a & set_b)
        overlap_score = min(overlap_count / 3.0, 1.0)

        score = 0.35 * cosine + 0.35 * jaccard + 0.15 * fuzzy + 0.15 * overlap_score
        return min(max(score, 0.0), 1.0)

    def extract_events(self, text: str) -> list[dict]:
        return []

    def generate_explanation(self, event_desc: str, activity_desc: str, score: float) -> str:
        tokens_event = set(_expand_synonyms(_tokenize(event_desc)))
        tokens_activity = set(_expand_synonyms(_tokenize(activity_desc)))
        common = tokens_event & tokens_activity

        if score >= 0.85:
            confidence_text = "HIGH confidence"
        elif score >= 0.65:
            confidence_text = "MEDIUM confidence"
        else:
            confidence_text = "LOW confidence"

        explanation_parts = [f"{confidence_text} match (confidence: {score * 100:.1f}%)."]

        if common:
            terms = ", ".join(f"'{w}'" for w in sorted(list(common))[:6])
            explanation_parts.append(f"Linked via key terms: {terms}.")

        syn_matches = []
        for t_e in _tokenize(event_desc):
            if t_e in SYNONYMS:
                syn_expanded = _tokenize(SYNONYMS[t_e])
                if set(syn_expanded) & tokens_activity:
                    syn_matches.append(f"{t_e.upper()} → {SYNONYMS[t_e]}")
        if syn_matches:
            explanation_parts.append(f"Discipline synonym resolution: {', '.join(syn_matches[:3])}.")

        return " ".join(explanation_parts)
