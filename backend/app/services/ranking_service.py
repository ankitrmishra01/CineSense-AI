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
    cohort_quality_score: Optional[float] = None,
    original_language: Optional[str] = None,
    preferred_languages: Optional[list[str]] = None,
    language_weight: float = 1.0,
) -> float:
    """
    Blends vector semantic similarity with Bayesian cohort quality, recency, and language preferences.
    Formula:
    65% Semantic Similarity + 20% Bayesian Quality Score + 10% Vote Confidence + 5% Recency,
    multiplied by a Language Preference Boost (1.0 to 1.15).
    """
    # 1. Base vector similarity
    sim = max(0.0, min(1.0, similarity_score))

    # 2. Quality factor (0.0 to 1.0)
    # If cohort_quality_score exists, use Bayesian shrinkage score (0-10) / 10.0
    if cohort_quality_score is not None and float(cohort_quality_score) > 0:
        quality_factor = min(1.0, float(cohort_quality_score) / 10.0)
    elif vote_average is not None and float(vote_average) > 0:
        quality_factor = min(1.0, float(vote_average) / 10.0)
    else:
        quality_factor = 0.60

    # 3. Vote count confidence log-scale (0 to 1.0)
    count = vote_count or 0
    if count >= 15:
        confidence = min(1.0, 0.5 + (math.log10(count + 1) / 8.0))
    else:
        confidence = max(0.2, math.log10(count + 1) / 4.0)

    # 4. Recency factor
    current_year = datetime.now().year
    year = release_year or (current_year - 20)
    years_ago = max(0, current_year - year)
    recency_factor = max(0.5, 1.0 - (years_ago / 80.0))

    base_score = (
        0.65 * sim +
        0.20 * quality_factor +
        0.10 * confidence +
        0.05 * recency_factor
    )

    # 5. Language preference boost
    lang_boost = 1.0
    if preferred_languages and original_language:
        if original_language in preferred_languages:
            rank_idx = preferred_languages.index(original_language)
            boost_bonus = max(0.04, 0.12 - (rank_idx * 0.04))
            lang_boost = 1.0 + (boost_bonus * language_weight)

    return round(base_score * lang_boost, 5)


def apply_diversity_rerank(
    movies: list[dict],
    preferred_languages: Optional[list[str]] = None,
    target_count: int = 20
) -> list[dict]:
    """
    Applies diversity re-ranking so the top results present a balanced mix
    across the user's preferred languages, while preserving high-relevance matches.
    """
    if not preferred_languages or len(preferred_languages) <= 1 or len(movies) <= 4:
        return movies[:target_count]

    # Partition by language
    by_lang: dict[str, list[dict]] = {l: [] for l in preferred_languages}
    others: list[dict] = []

    for m in movies:
        lang = m.get("original_language")
        if lang in by_lang:
            by_lang[lang].append(m)
        else:
            others.append(m)

    result = []
    seen_ids = set()

    # Round-robin allocation across preferred languages
    idx = 0
    max_len = max((len(lst) for lst in by_lang.values()), default=0)
    while len(result) < target_count and idx < max_len:
        for l in preferred_languages:
            if idx < len(by_lang[l]):
                movie = by_lang[l][idx]
                mid = movie.get("id")
                if mid not in seen_ids:
                    result.append(movie)
                    seen_ids.add(mid)
                    if len(result) >= target_count:
                        break
        idx += 1

    # Fill remaining slots with top remaining movies
    remaining = [m for m in movies if m.get("id") not in seen_ids]
    for m in remaining:
        if len(result) >= target_count:
            break
        result.append(m)
        seen_ids.add(m.get("id"))

    return result


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
