import logging
import json
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

class IntentResponse(BaseModel):
    intent: str
    entities: dict

async def classify_intent(query_text: str) -> IntentResponse:
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
        "Output: { \"intent\": \"ACTOR_DIRECTOR\", \"entities\": { \"person_name\": \"Christopher Nolan\", \"role\": \"director\" } }\n"
    )
    
    user_prompt = f"Input: '{query_text}'\nOutput:"
    
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
        return IntentResponse(intent=data.get("intent", "MOOD"), entities=data.get("entities", {}))
    except Exception as e:
        logger.error(f"Intent classification failed: {e}")
        # Safe fallback
        return IntentResponse(intent="MOOD", entities={"mood_description": query_text})
