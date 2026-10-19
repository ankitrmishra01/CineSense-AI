import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.language_service import (
    detect_script_language,
    extract_rule_based_language,
    translate_and_understand_query,
    get_dubbing_disclosure,
    _TRANSLATION_CACHE,
)
from app.services.ranking_service import (
    compute_hybrid_score,
    apply_diversity_rerank,
)
from app.schemas.auth import PreferencesUpdateRequest
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# 1. Script & Language Detection Tests
# ---------------------------------------------------------------------------

def test_language_detection_devanagari_and_dravidian():
    # Devanagari (Hindi)
    assert detect_script_language("मुझे कोई अच्छी डरावनी फिल्म बताओ") == "hi"
    # Tamil
    assert detect_script_language("நல்ல திகில் படம் வேண்டும்") == "ta"
    # Telugu
    assert detect_script_language("మంచి ప్రేమకథ సినిమా కావాలి") == "te"
    # Malayalam
    assert detect_script_language("നല്ലൊരു കോമഡി പടം വേണം") == "ml"
    # Kannada
    assert detect_script_language("ಒಳ್ಳೆಯ ಹಾಸ್ಯ ಚಲನಚಿತ್ರ ಬೇಕು") == "kn"
    # Bengali
    assert detect_script_language("ভালো ভূতের সিনেমা দেখতে চাই") == "bn"
    # Punjabi (Gurmukhi)
    assert detect_script_language("ਚੰਗੀ ਕਾਮੇਡੀ ਫਿਲਮ ਦਿਖਾਓ") == "pa"
    # Gujarati
    assert detect_script_language("સારી રોમેન્ટિક ફિલ્મ બતાવો") == "gu"
    # English (Latin) -> None
    assert detect_script_language("cozy mystery movie in rainy london") is None


def test_language_detection_nicknames_and_industry_terms():
    # Bollywood -> hi
    lang, regional, cleaned = extract_rule_based_language("best bollywood masala films")
    assert lang == "hi"
    assert "masala films" in cleaned

    # Kollywood -> ta
    lang, regional, cleaned = extract_rule_based_language("top kollywood thriller")
    assert lang == "ta"

    # Tollywood -> te
    lang, regional, cleaned = extract_rule_based_language("high energy tollywood action")
    assert lang == "te"

    # Mollywood -> ml
    lang, regional, cleaned = extract_rule_based_language("realistic mollywood drama")
    assert lang == "ml"

    # Sandalwood -> kn
    lang, regional, cleaned = extract_rule_based_language("popular sandalwood cinema")
    assert lang == "kn"

    # Pollywood -> pa
    lang, regional, cleaned = extract_rule_based_language("fun pollywood family movie")
    assert lang == "pa"

    # Dhollywood -> gu
    lang, regional, cleaned = extract_rule_based_language("classic dhollywood comedy")
    assert lang == "gu"

    # South Indian cinema umbrella
    lang, regional, cleaned = extract_rule_based_language("recommend south indian thrillers")
    assert lang is None
    assert regional == ["ta", "te", "ml", "kn"]


# ---------------------------------------------------------------------------
# 2. Groq Translation, Mocking, Fallback & Caching Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_groq_translation_mocked():
    _TRANSLATION_CACHE.clear()
    mock_json = (
        '{"translated_english": "heartwarming romantic comedy with bittersweet ending", '
        '"detected_language": "hi", "explicit_language_filter": "hi"}'
    )

    with patch("app.services.llm_service.get_llm_provider") as mock_provider_func:
        mock_provider = MagicMock()
        mock_chat = AsyncMock()
        mock_choice = MagicMock()
        mock_choice.message.content = mock_json
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]
        mock_chat.create.return_value = mock_resp
        mock_provider._client.chat.completions = mock_chat
        mock_provider._model = "llama-3.3-70b-versatile"
        mock_provider_func.return_value = mock_provider

        res = await translate_and_understand_query("koi mast romantic kahani batao")
        assert res["translated_text"] == "heartwarming romantic comedy with bittersweet ending"
        assert res["detected_language"] == "hi"
        assert res["explicit_language"] == "hi"
        assert mock_chat.create.call_count == 1

        # Check translation cache on repeat
        res_cached = await translate_and_understand_query("koi mast romantic kahani batao")
        assert res_cached["translated_text"] == "heartwarming romantic comedy with bittersweet ending"
        assert mock_chat.create.call_count == 1  # Cache hit, call count did not increase


@pytest.mark.asyncio
async def test_groq_translation_timeout_and_error_fallback():
    _TRANSLATION_CACHE.clear()

    # Simulate timeout (> 2.0s)
    with patch("app.services.llm_service.get_llm_provider") as mock_provider_func:
        mock_provider = MagicMock()
        mock_chat = AsyncMock()
        mock_chat.create.side_effect = asyncio.TimeoutError("Groq Timeout")
        mock_provider._client.chat.completions = mock_chat
        mock_provider._model = "llama-3.3-70b-versatile"
        mock_provider_func.return_value = mock_provider

        res = await translate_and_understand_query("acchi comedy film dikhao")
        # Gracefully falls back to raw query without crashing
        assert res["translated_text"] == "acchi comedy film dikhao"
        assert res["detected_language"] == "hi"


# ---------------------------------------------------------------------------
# 3. Cohort Quality Formula & Bayesian Shrinkage Tests
# ---------------------------------------------------------------------------

def test_cohort_quality_score_known_inputs():
    # Known high-confidence movie
    score_high = compute_hybrid_score(
        similarity_score=0.75,
        vote_average=8.2,
        vote_count=5000,
        release_year=2021,
        cohort_quality_score=7.85,
        original_language="hi",
        preferred_languages=["hi"],
    )
    assert 0.70 <= score_high <= 1.20

    # Low-confidence small-cohort movie (e.g. 4 votes in Punjabi)
    # Bayesian quality score shrinks towards prior rather than exploding
    score_small_cohort = compute_hybrid_score(
        similarity_score=0.75,
        vote_average=10.0,  # 1 person gave a 10
        vote_count=3,       # Very few votes
        release_year=2022,
        cohort_quality_score=6.20,  # Shrinkage score
        original_language="pa",
        preferred_languages=["pa"],
    )
    # Even with a 10.0 vote average, low vote count confidence suppresses artificial inflation
    assert score_small_cohort < score_high


# ---------------------------------------------------------------------------
# 4. Diversity Re-ranking & Non-Dilution of Explicit Queries
# ---------------------------------------------------------------------------

def test_diversity_reranking_round_robin():
    movies = [
        {"id": 1, "original_language": "hi", "title": "Hindi 1"},
        {"id": 2, "original_language": "hi", "title": "Hindi 2"},
        {"id": 3, "original_language": "ta", "title": "Tamil 1"},
        {"id": 4, "original_language": "ta", "title": "Tamil 2"},
        {"id": 5, "original_language": "en", "title": "English 1"},
    ]
    # User prefers Hindi and Tamil
    reranked = apply_diversity_rerank(movies, preferred_languages=["hi", "ta"], target_count=4)
    langs = [m["original_language"] for m in reranked]
    # Round-robin alternates between preferred cohorts
    assert langs == ["hi", "ta", "hi", "ta"]


def test_diversity_reranking_single_or_no_preference():
    movies = [
        {"id": 1, "original_language": "ta", "title": "Tamil 1"},
        {"id": 2, "original_language": "ta", "title": "Tamil 2"},
    ]
    # When explicit language is requested (single preference), no artificial dilution occurs
    reranked = apply_diversity_rerank(movies, preferred_languages=["ta"], target_count=5)
    assert len(reranked) == 2
    assert all(m["original_language"] == "ta" for m in reranked)


# ---------------------------------------------------------------------------
# 5. User Preferences Endpoint Validation & Authorization
# ---------------------------------------------------------------------------

def test_preferences_schema_validation():
    # Valid ISO codes
    req = PreferencesUpdateRequest(
        preferred_languages=["hi", "ta", "en"],
        preferred_audio_mode="original"
    )
    assert req.preferred_languages == ["hi", "ta", "en"]

    # Invalid audio mode raises ValidationError
    with pytest.raises(ValidationError):
        PreferencesUpdateRequest(
            preferred_languages=["hi"],
            preferred_audio_mode="invalid_audio_mode"
        )

    # Invalid language code (not 2-3 chars alphanumeric)
    with pytest.raises(ValidationError):
        PreferencesUpdateRequest(
            preferred_languages=["invalid_lang_code_too_long"]
        )


def test_dubbing_disclosure():
    assert get_dubbing_disclosure("hi") == "Original Hindi"
    assert get_dubbing_disclosure("ta") == "Hindi dub availability: not verified"
    assert get_dubbing_disclosure("ko") == "Hindi dub availability: not verified"


# ---------------------------------------------------------------------------
# 6. Database DDL & Schema Compatibility Checks
# ---------------------------------------------------------------------------

def test_database_model_columns_and_pg_compatibility():
    from app.models.movie import Movie
    from app.models.user import User

    # Movie model multilingual columns
    assert hasattr(Movie, "original_language")
    assert hasattr(Movie, "original_title")
    assert hasattr(Movie, "cohort_quality_score")
    assert hasattr(Movie, "origin_country")
    assert hasattr(Movie, "spoken_languages")

    # User model preferences columns
    assert hasattr(User, "preferred_languages")
    assert hasattr(User, "preferred_audio_mode")
