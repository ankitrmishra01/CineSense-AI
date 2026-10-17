"""
ranking_service.py — Hybrid re-ranking, match percentage normalization,
and natural language constraint extraction.
"""
import math
import re
from datetime import datetime
from typing import Optional

GENRE_NAME_TO_ID = {
    "action": 28,
    "adventure": 12,
    "animation": 16,
    "comedy": 35,
    "crime": 80,
    "documentary": 99,
    "drama": 18,
    "family": 10751,
    "fantasy": 14,
    "history": 36,
    "horror": 27,
    "music": 10402,
    "mystery": 9648,
    "romance": 10749,
    "sci-fi": 878,
    "scifi": 878,
    "thriller": 53,
    "war": 10752,
    "western": 37,
}

def calculate_match_percentage(raw_cosine_score: float) -> int:
    """
    Normalizes raw cosine similarity score [-1.0, 1.0] from all-MiniLM-L6-v2
    into an intuitive Match Percentage between 60% and 99%.

    Formula:
    Linear map from [0.20, 0.80] -> [60%, 99%].
    Scores below 0.20 clamp to 60%; scores above 0.80 clamp to 99%.
    """
    if raw_cosine_score >= 10.0:  # Direct database exact matches
        return 99

    normalized = 60.0 + (raw_cosine_score - 0.20) * (39.0 / 0.60)
    match_pct = int(round(normalized))
    return max(60, min(99, match_pct))


def compute_hybrid_score(
    similarity_score: float,
    vote_average: Optional[float] = None,
    vote_count: Optional[int] = None,
    release_year: Optional[int] = None,
) -> float:
    """
    Blends vector semantic similarity with audience credibility and recency:
    70% Vector Similarity + 15% Audience Rating + 10% Vote Volume Confidence + 5% Recency.
    Applies a vote count floor so unrated obscure movies do not dominate top results.
    """
    # 1. Base vector similarity
    sim = max(0.0, min(1.0, similarity_score))

    # 2. Rating factor (0.0 to 1.0)
    rating_factor = (float(vote_average) / 10.0) if vote_average else 0.60

    # 3. Vote count confidence log-scale (0 to 1.0)
    count = vote_count or 0
    confidence = min(1.0, math.log10(count + 1) / 4.0)

    # 4. Recency factor
    current_year = datetime.now().year
    year = release_year or (current_year - 20)
    years_ago = max(0, current_year - year)
    recency_factor = max(0.5, 1.0 - (years_ago / 80.0))

    # Low-count penalty: movies with fewer than 50 votes are discounted
    penalty = 1.0
    if count < 50:
        penalty = 0.82

    hybrid = (
        0.70 * sim +
        0.15 * rating_factor +
        0.10 * confidence +
        0.05 * recency_factor
    ) * penalty

    return round(hybrid, 5)


def extract_natural_constraints(query: str) -> dict:
    """
    Extracts structured constraints (negations, runtime, era) from natural language text.
    Example: 'want a funny movie no horror under 2 hours'
    Returns: {
        'exclude_genre_ids': [27],
        'max_runtime': 120,
        'min_year': 1990,
        'max_year': 1999
    }
    """
    constraints = {
        "exclude_genre_ids": [],
        "max_runtime": None,
        "min_year": None,
        "max_year": None,
    }
    q = query.lower()

    # Negation patterns: 'no horror', 'without romance', 'not scary'
    for genre_name, genre_id in GENRE_NAME_TO_ID.items():
        if re.search(rf"\b(?:no|without|not\s+too|not)\s+{genre_name}\b", q):
            constraints["exclude_genre_ids"].append(genre_id)

    # Runtime patterns: 'under 2 hours', 'less than 90 minutes', 'under 100m'
    hours_match = re.search(r"\b(?:under|less\s+than)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b", q)
    if hours_match:
        hours = float(hours_match.group(1))
        constraints["max_runtime"] = int(hours * 60)
    else:
        mins_match = re.search(r"\b(?:under|less\s+than)\s+(\d+)\s*(?:minutes?|mins?|m)\b", q)
        if mins_match:
            constraints["max_runtime"] = int(mins_match.group(1))

    # Era / Year patterns: 'from the 90s', 'from the 80s', 'from the 2000s'
    if "from the 90s" in q or "90s movies" in q:
        constraints["min_year"] = 1990
        constraints["max_year"] = 1999
    elif "from the 80s" in q or "80s movies" in q:
        constraints["min_year"] = 1980
        constraints["max_year"] = 1989
    elif "from the 70s" in q or "70s movies" in q:
        constraints["min_year"] = 1970
        constraints["max_year"] = 1979
    elif "from the 2000s" in q:
        constraints["min_year"] = 2000
        constraints["max_year"] = 2009

    return constraints
