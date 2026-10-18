import pytest
import uuid
import time
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

# ── 1. Auth Service Tests ───────────────────────────────────────────────────
from app.services import auth_service

def test_hash_and_verify_password():
    pwd = "MySecretPassword123!"
    hashed = auth_service.hash_password(pwd)
    assert hashed != pwd
    assert auth_service.verify_password(pwd, hashed) is True
    assert auth_service.verify_password("WrongPassword", hashed) is False

def test_jwt_access_token_creation_and_decode():
    uid = str(uuid.uuid4())
    username = "truffaut"
    token = auth_service.create_access_token(uid, username)
    assert isinstance(token, str)

    payload = auth_service.decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == uid
    assert payload["username"] == username
    assert payload["type"] == "access"

def test_jwt_decode_invalid_tokens():
    assert auth_service.decode_access_token("not-a-valid-token") is None
    from jose import jwt
    from app.config import settings
    bad_type_token = jwt.encode({"sub": "123", "type": "refresh"}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert auth_service.decode_access_token(bad_type_token) is None

def test_refresh_token_generation_and_hash():
    rt = auth_service.create_refresh_token()
    assert isinstance(rt, str)
    hashed = auth_service.hash_token(rt)
    assert isinstance(hashed, str)
    assert len(hashed) == 64
    assert hashed == auth_service.hash_token(rt)

@pytest.mark.asyncio
async def test_auth_service_db_helpers():
    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_db.delete = AsyncMock()
    mock_db.flush = AsyncMock()
    mock_db.refresh = AsyncMock()

    mock_user = MagicMock(id=uuid.uuid4(), email="test@cinema.com", username="tester")
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_user
    mock_db.execute = AsyncMock(return_value=mock_result)

    user = await auth_service.get_user_by_email(mock_db, "test@cinema.com")
    assert user == mock_user

    user2 = await auth_service.get_user_by_username(mock_db, "tester")
    assert user2 == mock_user

    user3 = await auth_service.get_user_by_id(mock_db, mock_user.id)
    assert user3 == mock_user

    new_user = await auth_service.create_user(mock_db, "new@cinema.com", "newbie", "password123")
    assert new_user.email == "new@cinema.com"
    assert new_user.username == "newbie"

    token_str = auth_service.create_refresh_token()
    rt_obj = await auth_service.store_refresh_token(mock_db, mock_user.id, token_str)
    assert rt_obj.user_id == mock_user.id

    mock_rt = MagicMock(id=uuid.uuid4(), user_id=mock_user.id, token_hash=auth_service.hash_token(token_str))
    mock_result.scalar_one_or_none.return_value = mock_rt
    val_rt = await auth_service.validate_refresh_token(mock_db, token_str)
    assert val_rt == mock_rt

    rotated = await auth_service.rotate_refresh_token(mock_db, token_str)
    assert rotated is not None
    r_user, new_tok = rotated
    assert r_user is not None
    assert isinstance(new_tok, str)

    await auth_service.revoke_refresh_token(mock_db, token_str)
    await auth_service.revoke_all_user_tokens(mock_db, mock_user.id)


# ── 2. TMDB Service Tests ───────────────────────────────────────────────────
from app.services import tmdb_service

def test_tmdb_trailer_extraction():
    data = {
        "results": [
            {"site": "Vimeo", "type": "Clip", "official": True, "key": "v1"},
            {"site": "YouTube", "type": "Teaser", "official": False, "key": "t1"},
            {"site": "YouTube", "type": "Trailer", "official": True, "key": "official_yt"},
        ]
    }
    assert tmdb_service.extract_trailer_key(data) == "official_yt"

    data_unofficial = {
        "results": [
            {"site": "YouTube", "type": "Trailer", "official": False, "key": "unofficial_yt"},
        ]
    }
    assert tmdb_service.extract_trailer_key(data_unofficial) == "unofficial_yt"

    assert tmdb_service.extract_trailer_key(None) is None
    assert tmdb_service.extract_trailer_key({"results": []}) is None

def test_tmdb_keywords_and_poster():
    kw_data = {"keywords": [{"id": 1, "name": "cyberpunk"}, {"id": 2, "name": "dystopia"}]}
    keywords = tmdb_service.extract_keywords(kw_data)
    assert keywords == ["cyberpunk", "dystopia"]
    assert tmdb_service.extract_keywords(None) == []

    assert tmdb_service.build_poster_url("/test.jpg") == "https://image.tmdb.org/t/p/w500/test.jpg"
    assert tmdb_service.build_poster_url(None) is None

@pytest.mark.asyncio
async def test_tmdb_api_getters_mocked():
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"results": [{"id": 101, "title": "Inception"}]}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        trending = await tmdb_service.get_trending_movies_async()
        assert len(trending) >= 1
        assert trending[0]["title"] == "Inception"

        now_playing = await tmdb_service.get_now_playing_movies_async()
        assert len(now_playing) >= 1

        similar = await tmdb_service.get_similar_movies_async(101)
        assert len(similar) >= 1


# ── 3. Intent Service Tests ─────────────────────────────────────────────────
from app.services import intent_service

def test_quick_rule_classify():
    res1 = intent_service._quick_rule_classify("movies like Inception")
    assert res1 is not None
    assert res1.intent == "SIMILAR_TO_MOVIE"
    assert res1.entities["movie_title"].lower() == "inception"

    res2 = intent_service._quick_rule_classify("directed by Christopher Nolan")
    assert res2 is not None
    assert res2.intent == "ACTOR_DIRECTOR"
    assert res2.entities["person_name"] == "Christopher Nolan"
    assert res2.entities["role"] == "director"

    res3 = intent_service._quick_rule_classify("movies with Tom Hanks")
    assert res3 is not None
    assert res3.intent == "ACTOR_DIRECTOR"
    assert res3.entities["person_name"] == "Tom Hanks"
    assert res3.entities["role"] == "actor"

    res4 = intent_service._quick_rule_classify("all Harry Potter movies")
    assert res4 is not None
    assert res4.intent == "FRANCHISE"
    assert "harry potter" in res4.entities["franchise_name"].lower()

@pytest.mark.asyncio
async def test_classify_intent_fallback():
    with patch("app.services.llm_service.get_llm_provider") as mock_prov:
        mock_llm = MagicMock()
        mock_llm.generate_explanations = AsyncMock(side_effect=Exception("Groq API Timeout"))
        mock_prov.return_value = mock_llm

        res = await intent_service.classify_intent("a strange ambiguous query that misses regex")
        assert res.intent == "MOOD"


# ── 4. Explanation Service Tests ────────────────────────────────────────────
from app.services import explanation_service
from app.models.movie import Movie

def test_generate_grounded_explanations_variants():
    m = Movie(
        id=1,
        title="Blade Runner 2049",
        overview="A young blade runner unearths a long-buried secret dealing with deep grief and loss.",
        tagline="There's still a page left.",
        keywords=["android", "memory"],
        genres=[{"id": 878, "name": "Sci-Fi"}, {"id": 9648, "name": "Mystery"}],
        vote_average=8.0,
        release_date=datetime(2017, 10, 6).date()
    )

    # Actor/Director
    exp_dir = explanation_service.generate_grounded_explanation(m, "Denis Villeneuve", 0.85, "ACTOR_DIRECTOR")
    assert "2017" in exp_dir and "Sci-Fi" in exp_dir

    # Franchise
    exp_fran = explanation_service.generate_grounded_explanation(m, "Blade Runner collection", 0.90, "FRANCHISE")
    assert "chapter in the collection" in exp_fran

    # Similar
    exp_sim = explanation_service.generate_grounded_explanation(m, "Blade Runner", 0.88, "SIMILAR_TO_MOVIE")
    assert "similar" in exp_sim.lower()

    # Mood with matched themes
    exp_mood_theme = explanation_service.generate_grounded_explanation(m, "deep grief and crying", 0.82, "MOOD")
    assert "grief" in exp_mood_theme.lower() or "loss" in exp_mood_theme.lower()

    # Mood fallback tagline
    m_no_theme = Movie(id=2, title="Up", overview="Floating house.", tagline="Adventure is out there.", genres=[{"id": 16, "name": "Animation"}])
    exp_tag = explanation_service.generate_grounded_explanation(m_no_theme, "fun movie", 0.70, "MOOD")
    assert "Adventure is out there" in exp_tag

    # High vote fallback
    m_vote = Movie(id=3, title="Interstellar", overview="Astronauts search for planets.", vote_average=8.6, genres=[{"id": 18, "name": "Drama"}])
    exp_vote = explanation_service.generate_grounded_explanation(m_vote, "space", 0.75, "MOOD")
    assert "8.6/10" in exp_vote


# ── 5. LLM Service Tests ────────────────────────────────────────────────────
from app.services import llm_service

def test_movie_context_dataclass():
    ctx = llm_service.MovieContext(
        title="Chinatown",
        overview="A private detective is hired to expose an adulterer.",
        tagline="You can't always tell who's on your side.",
        genres=["Mystery", "Drama"],
        vote_average=8.2,
        release_year=1974
    )
    assert ctx.title == "Chinatown"
    assert ctx.release_year == 1974

@pytest.mark.asyncio
async def test_llm_service_empty_input():
    provider = llm_service.get_llm_provider()
    res = await provider.generate_explanations("cozy mood", [])
    assert res == []

@pytest.mark.asyncio
async def test_llm_service_with_mocked_groq():
    provider = llm_service.get_llm_provider()
    ctx = llm_service.MovieContext(
        title="Inception",
        overview="A thief who steals corporate secrets.",
        tagline="Your mind is the scene of the crime.",
        genres=["Sci-Fi", "Action"],
        vote_average=8.4,
        release_year=2010
    )
    with patch.object(provider, "_client") as mock_client:
        mock_chat = AsyncMock()
        mock_choice = MagicMock()
        mock_choice.message.content = '{"explanations": ["A mind-bending heist thriller attuned to your mood."]}'
        mock_chat.completions.create = AsyncMock(return_value=MagicMock(choices=[mock_choice]))
        mock_client.chat = mock_chat

        exps = await provider.generate_explanations("mind bending thriller", [ctx])
        assert len(exps) == 1
        assert "mind-bending" in exps[0]


# ── 6. Rate Limiter Tests ───────────────────────────────────────────────────
from app.services.rate_limiter import InMemoryRateLimiter
from fastapi import Request, HTTPException

def test_rate_limiter_edge_cases():
    limiter = InMemoryRateLimiter(max_requests=2, window_seconds=1)
    ip = "192.168.1.100"

    allowed1, retry1 = limiter.is_allowed(ip)
    assert allowed1 is True
    assert retry1 == 0

    allowed2, retry2 = limiter.is_allowed(ip)
    assert allowed2 is True
    assert retry2 == 0

    allowed3, retry3 = limiter.is_allowed(ip)
    assert allowed3 is False
    assert retry3 >= 1

    time.sleep(1.05)
    allowed4, retry4 = limiter.is_allowed(ip)
    assert allowed4 is True
    assert retry4 == 0

def test_rate_limiter_check_request():
    limiter = InMemoryRateLimiter(max_requests=1, window_seconds=60)
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {}
    mock_request.client.host = "10.0.0.1"

    limiter.check_request(mock_request, identifier="test")
    # 2nd request should raise 429
    with pytest.raises(HTTPException) as exc_info:
        limiter.check_request(mock_request, identifier="test")
    assert exc_info.value.status_code == 429


# ── 7. FAISS Service Behavioral Tests ───────────────────────────────────────
from app.services import faiss_service

def test_faiss_embed_texts_batch():
    texts = ["a cozy morning in a cabin", "a high-octane car chase downtown"]
    vecs = faiss_service.embed_texts(texts)
    assert vecs.shape == (2, 384)
    import numpy as np
    assert abs(np.linalg.norm(vecs[0]) - 1.0) < 1e-4
    assert abs(np.linalg.norm(vecs[1]) - 1.0) < 1e-4

def test_faiss_search_by_vector_direct():
    vec = faiss_service.embed_text("space adventure")
    res = faiss_service.search_by_vector(vec, top_k=3)
    assert len(res) == 3
    for mid, score in res:
        assert isinstance(mid, int)
        assert -1.0 <= score <= 1.05

def test_faiss_get_movie_vector():
    vec = faiss_service.get_movie_vector(0)
    assert vec is not None
    assert vec.shape == (1, 384)
    # Non-existent index
    vec_invalid = faiss_service.get_movie_vector(9999999)
    assert vec_invalid is None

def test_tmdb_sync_and_cache_hits():
    with patch("httpx.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"id": 1, "results": {"US": {"flatrate": []}}}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        det = tmdb_service.get_movie_details_sync(1)
        assert det is not None
        prov = tmdb_service.get_watch_providers_sync(1)
        assert prov is not None

@pytest.mark.asyncio
async def test_tmdb_async_cache_hits():
    # Calling trending and now_playing twice hits the in-memory TTLCache
    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"results": [{"id": 99, "title": "Cached"}]}
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        res1 = await tmdb_service.get_trending_movies_async()
        res2 = await tmdb_service.get_trending_movies_async()
        assert res1 == res2

        np1 = await tmdb_service.get_now_playing_movies_async()
        np2 = await tmdb_service.get_now_playing_movies_async()
        assert np1 == np2

@pytest.mark.asyncio
async def test_llm_service_error_fallback():
    provider = llm_service.get_llm_provider()
    ctx = llm_service.MovieContext("Movie", "Overview", None, ["Action"], 7.0, 2020)
    with patch.object(provider, "_client") as mock_client:
        mock_client.chat.completions.create = AsyncMock(side_effect=Exception("API Error"))
        # Should gracefully return empty list or fallback without crashing
        res = await provider.generate_explanations("test", [ctx])
        assert isinstance(res, list)

