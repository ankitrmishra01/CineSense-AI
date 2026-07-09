"""
LLM service — clean, provider-agnostic interface for generating movie explanations.

Provider: Groq (llama-3.1-8b-instant) — fast, low-latency, excellent for short text generation.
To swap providers: implement a new class inheriting BaseLLMProvider and update get_llm_provider().
"""
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class MovieContext:
    title: str
    overview: Optional[str]
    tagline: Optional[str]
    genres: list[str]
    vote_average: Optional[float]
    release_year: Optional[int]


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate_explanations(
        self,
        mood_text: str,
        movies: list[MovieContext],
    ) -> list[str]:
        """
        Given a mood description and a list of movie contexts,
        return one short explanation string per movie (same order as input).
        """
        ...


class GroqProvider(BaseLLMProvider):
    def __init__(self):
        from app.config import settings
        from groq import AsyncGroq

        self._client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self._model = settings.GROQ_MODEL

    async def generate_explanations(
        self,
        mood_text: str,
        movies: list[MovieContext],
    ) -> list[str]:
        if not movies:
            return []

        # Build a numbered list of movies for a single batched prompt
        movie_lines = []
        for i, m in enumerate(movies, 1):
            genre_str = ", ".join(m.genres) if m.genres else "Unknown"
            year = m.release_year or "Unknown"
            rating = f"{m.vote_average:.1f}/10" if m.vote_average else "N/A"
            line = (
                f"{i}. **{m.title}** ({year}) | Genres: {genre_str} | Rating: {rating}\n"
                f"   Overview: {(m.overview or 'N/A')[:300]}\n"
                f"   Tagline: {m.tagline or 'N/A'}"
            )
            movie_lines.append(line)

        movies_block = "\n\n".join(movie_lines)

        system_prompt = (
            "You are CineSense AI, an empathetic movie guide. "
            "Your job is to write SHORT, emotionally resonant explanations (2–3 sentences max) "
            "for why each movie matches the user's current mood. "
            "Be warm, personal, and specific — reference the movie's actual tone or story. "
            "Do NOT be generic. Do NOT use phrases like 'this movie is perfect for you'."
        )

        user_prompt = (
            f"The user says: \"{mood_text}\"\n\n"
            f"Movies to explain (one explanation per movie, numbered 1 to {len(movies)}):\n\n"
            f"{movies_block}\n\n"
            f"Respond with ONLY a numbered list matching the movie numbers above. "
            f"Each entry: just the explanation text, no title repeat. "
            f"Format:\n1. <explanation>\n2. <explanation>\n..."
        )

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=1024,
            )
            raw = response.choices[0].message.content.strip()
            return _parse_numbered_list(raw, len(movies))
        except Exception as e:
            logger.error("Groq API error: %s", e)
            # Graceful degradation — return empty explanations rather than crashing
            return ["" for _ in movies]


def _parse_numbered_list(text: str, expected: int) -> list[str]:
    """Parse '1. ...\n2. ...' format into a list of strings."""
    import re
    lines = re.split(r"\n(?=\d+\.)", text.strip())
    result = []
    for line in lines:
        cleaned = re.sub(r"^\d+\.\s*", "", line.strip())
        if cleaned:
            result.append(cleaned)
    # Pad with empty strings if LLM returned fewer items than expected
    while len(result) < expected:
        result.append("")
    return result[:expected]


# ─── Provider factory ──────────────────────────────────────────────────────────

_provider: Optional[BaseLLMProvider] = None


def get_llm_provider() -> BaseLLMProvider:
    """
    Returns the active LLM provider singleton.
    To swap to a different provider, change the class instantiated here.
    """
    global _provider
    if _provider is None:
        _provider = GroqProvider()
    return _provider


async def generate_explanations(mood_text: str, movies: list[MovieContext]) -> list[str]:
    """Public API used by the recommendation router."""
    provider = get_llm_provider()
    return await provider.generate_explanations(mood_text, movies)
