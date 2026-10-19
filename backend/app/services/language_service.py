"""
language_service.py — Language detection, rule-based classification,
Groq translation with 2-second timeout & caching, and dubbing disclosures.
"""
import os
import re
import json
import time
import asyncio
import logging
from typing import Optional, Dict, Tuple, Any

logger = logging.getLogger(__name__)

# Cache for translations: query_hash -> (translated_text, detected_lang, explicit_lang, timestamp)
_TRANSLATION_CACHE: Dict[str, Tuple[str, Optional[str], Optional[str], float]] = {}
CACHE_TTL_SECONDS = 3600  # 1 hour

LANGUAGE_METADATA = {
    "hi": {"name": "Hindi", "native": "हिन्दी", "nicknames": ["bollywood", "hindi", "hindi cinema"]},
    "ta": {"name": "Tamil", "native": "தமிழ்", "nicknames": ["kollywood", "tamil", "tamil cinema"]},
    "te": {"name": "Telugu", "native": "తెలుగు", "nicknames": ["tollywood", "telugu", "telugu cinema"]},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "nicknames": ["mollywood", "malayalam", "malayalam cinema"]},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "nicknames": ["sandalwood", "kannada", "kannada cinema"]},
    "bn": {"name": "Bengali", "native": "বাংলা", "nicknames": ["bengali", "bangla"]},
    "mr": {"name": "Marathi", "native": "मराठी", "nicknames": ["marathi"]},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "nicknames": ["punjabi", "pollywood"]},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "nicknames": ["gujarati", "dhollywood"]},
    "ko": {"name": "Korean", "native": "한국어", "nicknames": ["k-cinema", "k cinema", "k-drama", "kdrama", "korean"]},
    "ja": {"name": "Japanese", "native": "日本語", "nicknames": ["anime", "japanese"]},
    "es": {"name": "Spanish", "native": "Español", "nicknames": ["spanish", "espanol"]},
    "fr": {"name": "French", "native": "Français", "nicknames": ["french", "francais"]},
    "en": {"name": "English", "native": "English", "nicknames": ["hollywood", "english"]},
}

# Unicode Script Patterns
SCRIPT_PATTERNS = [
    ("hi", re.compile(r"[\u0900-\u097F]")),  # Devanagari (Hindi, Marathi)
    ("ta", re.compile(r"[\u0B80-\u0BFF]")),  # Tamil
    ("te", re.compile(r"[\u0C00-\u0C7F]")),  # Telugu
    ("ml", re.compile(r"[\u0D00-\u0D7F]")),  # Malayalam
    ("kn", re.compile(r"[\u0C80-\u0CFF]")),  # Kannada
    ("bn", re.compile(r"[\u0980-\u09FF]")),  # Bengali
    ("pa", re.compile(r"[\u0A00-\u0A7F]")),  # Gurmukhi (Punjabi)
    ("gu", re.compile(r"[\u0A80-\u0AFF]")),  # Gujarati
    ("ko", re.compile(r"[\uAC00-\uD7AF\u1100-\u11FF]")),  # Hangul
    ("ja", re.compile(r"[\u3040-\u30FF\u31F0-\u31FF]")),  # Hiragana/Katakana
]

# Common Hinglish terms
HINGLISH_KEYWORDS = {
    "batao", "dekhna", "kaisi", "chahiye", "acchi", "accha", "zabardast", "koi",
    "kuch", "shandar", "badhiya", "dost", "pyaar", "ishq", "hasne", "rone",
    "bataiye", "dikhao", "wali", "wale", "kahani", "dhamaka", "mast"
}


def detect_script_language(query: str) -> Optional[str]:
    """Detect if query text is written in a non-Latin script."""
    for lang, pattern in SCRIPT_PATTERNS:
        if pattern.search(query):
            return lang
    return None


def extract_rule_based_language(query: str) -> Tuple[Optional[str], Optional[list[str]], str]:
    """
    Fast rule-based entity extractor for industry nicknames, languages, and regional cinema.
    Returns: (explicit_language, regional_languages_list, cleaned_query)
    """
    q_lower = query.lower()
    cleaned = query

    # South Indian cinema check
    south_match = re.search(r"\b(south\s+indian?|south\s+movies?|south\s+cinema)\b", q_lower)
    if south_match:
        cleaned = re.sub(r"\b(south\s+indian?|south\s+movies?|south\s+cinema)\b", "", cleaned, flags=re.IGNORECASE).strip()
        return None, ["ta", "te", "ml", "kn"], cleaned

    # Check industry nicknames and explicit language names
    for lang, meta in LANGUAGE_METADATA.items():
        for nick in meta["nicknames"]:
            pattern = rf"\b{re.escape(nick)}(\s+movies?|\s+films?|\s+cinema)?\b"
            if re.search(pattern, q_lower):
                cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()
                return lang, None, cleaned

    # Check native script in text
    script_lang = detect_script_language(query)
    if script_lang:
        return script_lang, None, cleaned

    return None, None, cleaned


async def translate_and_understand_query(query: str) -> dict:
    """
    Translates non-English or Hinglish queries to English using Groq with 2.0s timeout and caching.
    Extracts explicit language filters, themes, and emotional intent.
    Falls back gracefully to raw text on timeout or error.
    """
    q_trimmed = query.strip()
    if not q_trimmed:
        return {"translated_text": "", "detected_language": "en", "explicit_language": None, "regional_languages": None}

    # 1. Rule-based extraction first
    explicit_lang, regional_langs, rule_cleaned = extract_rule_based_language(q_trimmed)
    script_lang = detect_script_language(q_trimmed)
    
    # Hinglish check
    words = set(re.findall(r"\w+", q_trimmed.lower()))
    is_hinglish = bool(words & HINGLISH_KEYWORDS)

    # If it's pure English without foreign script or Hinglish, no translation is needed
    if not script_lang and not is_hinglish:
        return {
            "translated_text": rule_cleaned or q_trimmed,
            "detected_language": explicit_lang or "en",
            "explicit_language": explicit_lang,
            "regional_languages": regional_langs
        }

    # 2. Check translation cache
    cache_key = q_trimmed.lower()
    now = time.time()
    if cache_key in _TRANSLATION_CACHE:
        tr_text, d_lang, exp_lang, ts = _TRANSLATION_CACHE[cache_key]
        if now - ts < CACHE_TTL_SECONDS:
            return {
                "translated_text": tr_text,
                "detected_language": d_lang or script_lang or "hi",
                "explicit_language": exp_lang or explicit_lang,
                "regional_languages": regional_langs
            }

    # 3. Call Groq with 2.0s bounded timeout
    translated_text = q_trimmed
    detected_lang = script_lang or ("hi" if is_hinglish else "en")

    try:
        from app.services.llm_service import get_llm_provider
        provider = get_llm_provider()

        system_prompt = (
            "You are a translation and semantic parser for a multilingual movie discovery system. "
            "Your job is to translate user queries (in Hindi, Hinglish, Tamil, Telugu, Malayalam, Kannada, Bengali, etc.) "
            "into clean, descriptive English suitable for semantic embedding search. "
            "Preserve movie genres, emotional moods, tropes, and intent. "
            "Output strictly valid JSON with keys:\n"
            "- 'translated_english': English translation of the movie intent (e.g., 'heartwarming emotional romantic drama').\n"
            "- 'detected_language': ISO 639-1 code (e.g. 'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'ko', 'en').\n"
            "- 'explicit_language_filter': Language code if user explicitly requested that language, else null."
        )

        user_content = f"<user_query>{q_trimmed}</user_query>"

        async def _call_groq():
            resp = await provider._client.chat.completions.create(
                model=provider._model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
                temperature=0.0,
                response_format={"type": "json_object"},
                max_tokens=150,
            )
            return resp.choices[0].message.content.strip()

        # Enforce strict 2.0s timeout
        raw_res = await asyncio.wait_for(_call_groq(), timeout=2.0)
        parsed = json.loads(raw_res)

        translated_text = parsed.get("translated_english") or q_trimmed
        detected_lang = parsed.get("detected_language") or detected_lang
        if parsed.get("explicit_language_filter"):
            explicit_lang = parsed["explicit_language_filter"]

        # Cache result
        _TRANSLATION_CACHE[cache_key] = (translated_text, detected_lang, explicit_lang, now)
        logger.info(f"Groq translated '{q_trimmed}' -> '{translated_text}' (lang={detected_lang}, filter={explicit_lang})")

    except asyncio.TimeoutError:
        logger.warning(f"Groq translation timed out (>2.0s) for query: '{q_trimmed}'. Falling back to raw text.")
    except Exception as e:
        logger.warning(f"Groq translation error: {e}. Falling back to raw text.")

    return {
        "translated_text": translated_text,
        "detected_language": detected_lang,
        "explicit_language": explicit_lang,
        "regional_languages": regional_langs
    }


def get_dubbing_disclosure(original_language: Optional[str]) -> str:
    """
    Returns the honest dubbing disclosure as mandated:
    'Hindi dub availability: not verified' for non-Hindi movies.
    """
    if not original_language or original_language == "hi":
        return "Original Hindi"
    return "Hindi dub availability: not verified"
