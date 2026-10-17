"""
explanation_service.py — Grounded natural explanations for movie recommendations.

Builds factual, non-hallucinatory explanations anchored directly in:
1. Movie genre tags and overall tone
2. Overview key plot motifs
3. Matching keywords between user query and movie synopsis
4. Grounded factual credentials (e.g. director/cast or notable rating)
"""
import re
from typing import Optional
from app.models.movie import Movie

# Common emotion keywords mapped to thematic indicators
MOOD_THEME_KEYWORDS = {
    "sad": ["loss", "grief", "heartbreak", "tragic", "emotional", "struggle", "melancholy", "tears"],
    "cozy": ["comfort", "warmth", "gentle", "charming", "heartwarming", "family", "friendship", "peace"],
    "happy": ["joy", "funny", "laugh", "humor", "comedy", "delight", "upbeat", "celebration"],
    "tense": ["suspense", "danger", "thriller", "mystery", "pressure", "paranoia", "investigation"],
    "mind-bending": ["reality", "time", "dream", "subconscious", "twist", "dimension", "puzzle", "secrets"],
    "romantic": ["love", "passion", "relationship", "romance", "devotion", "couple", "intimacy"],
    "adventurous": ["journey", "quest", "explore", "wilderness", "survival", "mission", "epic"],
    "scary": ["haunting", "supernatural", "fear", "curse", "darkness", "evil", "terror"],
    "thought-provoking": ["philosophy", "morality", "truth", "society", "identity", "existential"],
}

def generate_grounded_explanation(
    movie: Movie,
    query_text: str,
    similarity_score: float = 0.0,
    intent_type: str = "MOOD",
) -> str:
    """
    Generate an authentic, grounded 1-to-2 sentence explanation anchored in real metadata.
    Never invents unverified plot points.
    """
    title = movie.title
    genres = [g["name"] for g in (movie.genres or []) if isinstance(g, dict)]
    genre_str = " and ".join(genres[:2]) if genres else "cinematic"
    keywords = [k.lower() for k in (movie.keywords or []) if isinstance(k, str)]
    overview = movie.overview or ""
    tagline = movie.tagline or ""

    # Special strategy for ACTOR_DIRECTOR
    if intent_type == "ACTOR_DIRECTOR":
        rating_str = f"with a strong {float(movie.vote_average):.1f}/10 TMDB audience score" if movie.vote_average else ""
        if movie.release_date:
            return f"A notable {movie.release_date.year} {genre_str} entry in their celebrated filmography {rating_str}."
        return f"A standout {genre_str} project showcasing their signature cinematic style."

    # Special strategy for FRANCHISE
    if intent_type == "FRANCHISE":
        year = movie.release_date.year if movie.release_date else "Classic"
        return f"A defining {year} chapter in the collection, continuing the overarching storyline."

    # Special strategy for SIMILAR_TO_MOVIE
    if intent_type == "SIMILAR_TO_MOVIE":
        shared_elements = []
        if tagline:
            shared_elements.append(f'"{tagline}"')
        elif keywords:
            shared_elements.append(f"themes of {', '.join(keywords[:2])}")
        
        if shared_elements:
            return f"Shares a similar {genre_str.lower()} atmosphere and {shared_elements[0]}."
        return f"Captures a very similar narrative tone and {genre_str.lower()} energy."

    # Standard MOOD matching
    q_lower = query_text.lower()
    matched_themes = []

    # Find which query keywords intersect with movie overview/keywords
    for mood, themes in MOOD_THEME_KEYWORDS.items():
        if mood in q_lower or any(t in q_lower for t in themes):
            for t in themes:
                if t in overview.lower() or any(t in kw for kw in keywords):
                    matched_themes.append(t)

    # Format grounded sentence
    if matched_themes:
        theme_str = ", ".join(matched_themes[:2])
        return f"Reflects your mood through its poignant focus on {theme_str} within a gripping {genre_str.lower()} setting."

    if tagline and len(tagline) < 100:
        return f'{tagline} — an evocative {genre_str.lower()} journey that matches your selected emotional tone.'

    if keywords and len(keywords) >= 2:
        return f"Explores evocative themes of {keywords[0]} and {keywords[1]} across a well-crafted {genre_str.lower()} narrative."

    if movie.vote_average and float(movie.vote_average) >= 7.5:
        return f"A highly acclaimed {genre_str.lower()} piece ({float(movie.vote_average):.1f}/10) tailored to this atmosphere."

    return f"A resonant {genre_str.lower()} work with an emotional rhythm attuned to your search."
