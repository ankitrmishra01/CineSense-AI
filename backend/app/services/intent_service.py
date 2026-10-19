import logging
import json
import re
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

class IntentResponse(BaseModel):
    intent: str
    entities: dict = Field(default_factory=dict)


def _quick_rule_classify(query: str) -> Optional[IntentResponse]:
    """Fast regex-based intent classification for obvious patterns."""
    q = query.strip()
    q_lower = q.lower()

    # Similar to movie patterns
    similar_match = re.match(r"^(?:movies?\s+(?:like|similar\s+to)|films?\s+(?:like|similar\s+to)|recommend\s+(?:movies?|films?)\s+like)\s+['\"]?([^'\"]+)['\"]?$", q, re.IGNORECASE)
    if similar_match:
        return IntentResponse(intent="SIMILAR_TO_MOVIE", entities={"movie_title": similar_match.group(1).strip()})

    # Director patterns
    director_match = re.match(r"^(?:movies?\s+(?:directed\s+by|by\s+director)|films?\s+directed\s+by|directed\s+by)\s+['\"]?([^'\"]+)['\"]?$", q, re.IGNORECASE)
    if director_match:
        return IntentResponse(intent="ACTOR_DIRECTOR", entities={"person_name": director_match.group(1).strip(), "role": "director"})

    # Actor patterns
    actor_match = re.match(r"^(?:movies?\s+(?:with|starring)|films?\s+(?:with|starring))\s+['\"]?([^'\"]+)['\"]?$", q, re.IGNORECASE)
    if actor_match:
        return IntentResponse(intent="ACTOR_DIRECTOR", entities={"person_name": actor_match.group(1).strip(), "role": "actor"})

    # Franchise patterns
    franchise_match = re.match(r"^(?:all\s+['\"]?([^'\"]+)['\"]?\s+(?:movies|films)|(?:every|all\s+the)\s+['\"]?([^'\"]+)['\"]?\s+(?:movies?|films?)|['\"]?([^'\"]+)['\"]?\s+(?:all\s+movies|franchise|collection))$", q, re.IGNORECASE)
    if franchise_match:
        name = franchise_match.group(1) or franchise_match.group(2) or franchise_match.group(3)
        return IntentResponse(intent="FRANCHISE", entities={"franchise_name": name.strip()})

    # Quick heuristic for obvious mood/genre descriptions
    MOOD_WORDS = {
        "comfort", "melancholic", "rainy", "intense", "psychological", "twist",
        "comedy", "noir", "horror", "space", "romance", "courtroom", "satire",
        "sports", "underdog", "time travel", "divorce", "fantasy", "whimsical",
        "atmospheric", "suspense", "mystery", "thriller", "action", "drama",
        "sad", "heartbroken", "grieving", "happy", "uplifting", "feel", "night", "story"
    }
    words = set(re.findall(r"\w+", q_lower))
    if len(words & MOOD_WORDS) >= 2 or any(p in q_lower for p in ["comfort movie", "plot twist", "time travel", "rainy night", "coming of age"]):
        return IntentResponse(intent="MOOD", entities={"mood_description": q})

    return None

async def classify_intent(query_text: str) -> IntentResponse:
    # 1. Fast deterministic rule match
    rule_match = _quick_rule_classify(query_text)
    if rule_match:
        logger.info(f"Intent resolved by rule: {rule_match.intent} -> {rule_match.entities}")
        return rule_match

    # 2. LLM classification via Groq with fast 1.2s timeout and safe fallback
    import asyncio
    from app.services.llm_service import get_llm_provider
    provider = get_llm_provider()
    
    system_prompt = (
        "You are an intent classification engine for a movie recommendation app. "
        "Output strictly valid JSON with keys 'intent' and 'entities'.\n"
        "Supported Intents: MOOD, SIMILAR_TO_MOVIE, FRANCHISE, GENRE_FILTER, ACTOR_DIRECTOR."
    )
    user_prompt = f"Input: '{query_text}'\nOutput:"
    
    try:
        async def _call():
            return await provider._client.chat.completions.create(
                model=provider._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
                max_tokens=80,
            )
        response = await asyncio.wait_for(_call(), timeout=1.2)
        raw_json = response.choices[0].message.content.strip()
        data = json.loads(raw_json)
        intent = data.get("intent", "MOOD")
        if intent not in ["MOOD", "SIMILAR_TO_MOVIE", "FRANCHISE", "GENRE_FILTER", "ACTOR_DIRECTOR"]:
            intent = "MOOD"
        return IntentResponse(intent=intent, entities=data.get("entities", {}))
    except Exception as e:
        logger.info(f"Intent classification skipped/fallback ({e}); defaulting to MOOD.")

    # Safe fallback
    return IntentResponse(intent="MOOD", entities={"mood_description": query_text})

