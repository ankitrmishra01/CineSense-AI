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

    # Pure emoji / emotion tag pattern
    if any(tag in q for tag in ["sad, heartbroken", "happy, funny", "anxious, stressed", "warm, comforting", "surprised, mind-blowing", "thought-provoking", "romantic, love", "cool, action", "relaxing, slow", "intense, exciting", "scary, horror", "dreamy, atmospheric"]):
        return IntentResponse(intent="MOOD", entities={"mood_description": q})

    return None

async def classify_intent(query_text: str) -> IntentResponse:
    # 1. Fast deterministic rule match
    rule_match = _quick_rule_classify(query_text)
    if rule_match:
        logger.info(f"Intent resolved by rule: {rule_match.intent} -> {rule_match.entities}")
        return rule_match

    # 2. LLM classification via Groq
    from app.services.llm_service import get_llm_provider
    provider = get_llm_provider()
    
    system_prompt = (
        "You are a highly accurate intent classification engine for a movie recommendation app. "
        "Your sole purpose is to analyze user queries and output a strictly formatted JSON object.\n\n"
        "Supported Intents:\n"
        "1. MOOD: For general vibes, emotional requests, or broad descriptive searches (e.g. 'feeling sad', 'want a cozy movie', 'mind bending sci fi', 'movies about space').\n"
        "2. SIMILAR_TO_MOVIE: User wants movies similar to a specific movie.\n"
        "3. FRANCHISE: User wants all movies in a specific series or franchise.\n"
        "4. GENRE_FILTER: User wants a specific genre, optionally from a specific era/year, with NO emotional/mood context (e.g. 'action movies from the 90s', 'horror movies').\n"
        "5. ACTOR_DIRECTOR: User wants movies by a specific actor or director.\n\n"
        "Rules:\n"
        "- Respond with ONLY valid JSON. No markdown formatting, no code blocks.\n"
        "- Schema: { \"intent\": \"...\", \"entities\": { ... } }\n\n"
        "Few-shot Examples:\n"
        "Input: 'I'm feeling lonely and want something comforting'\n"
        "Output: { \"intent\": \"MOOD\", \"entities\": { \"mood_description\": \"lonely, comforting\" } }\n\n"
        "Input: 'movies like Interstellar'\n"
        "Output: { \"intent\": \"SIMILAR_TO_MOVIE\", \"entities\": { \"movie_title\": \"Interstellar\" } }\n\n"
        "Input: 'the lord of the rings all movies'\n"
        "Output: { \"intent\": \"FRANCHISE\", \"entities\": { \"franchise_name\": \"The Lord of the Rings\" } }\n\n"
        "Input: 'action movies from the 90s'\n"
        "Output: { \"intent\": \"GENRE_FILTER\", \"entities\": { \"genre\": \"Action\", \"year_range\": \"1990-1999\" } }\n\n"
        "Input: 'movies directed by Christopher Nolan'\n"
        "Output: { \"intent\": \"ACTOR_DIRECTOR\", \"entities\": { \"person_name\": \"Christopher Nolan\", \"role\": \"director\" } }\n\n"
        "Input: 'movies with Tom Hanks'\n"
        "Output: { \"intent\": \"ACTOR_DIRECTOR\", \"entities\": { \"person_name\": \"Tom Hanks\", \"role\": \"actor\" } }\n\n"
        "Input: 'Leonardo DiCaprio movies'\n"
        "Output: { \"intent\": \"ACTOR_DIRECTOR\", \"entities\": { \"person_name\": \"Leonardo DiCaprio\", \"role\": \"unspecified\" } }\n"
    )
    
    user_prompt = f"Input: '{query_text}'\nOutput:"
    
    for attempt in range(2):
        try:
            response = await provider._client.chat.completions.create(
                model=provider._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
                max_tokens=150,
            )
            raw_json = response.choices[0].message.content.strip()
            data = json.loads(raw_json)
            intent = data.get("intent", "MOOD")
            if intent not in ["MOOD", "SIMILAR_TO_MOVIE", "FRANCHISE", "GENRE_FILTER", "ACTOR_DIRECTOR"]:
                intent = "MOOD"
            return IntentResponse(intent=intent, entities=data.get("entities", {}))
        except Exception as e:
            logger.warning(f"Intent classification attempt {attempt+1} failed: {e}")
            if attempt == 1:
                break

    # Safe fallback
    return IntentResponse(intent="MOOD", entities={"mood_description": query_text})

