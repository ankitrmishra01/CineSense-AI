import pytest
from pydantic import ValidationError
from app.schemas.auth import ChangePasswordRequest, SignupRequest
from app.services.faiss_service import verify_embedding_model_parity
from app.services.language_service import get_translation_stats


def test_password_schema_validation_rejects_weak_and_short():
    # 1. Rejects short password (< 8 chars)
    with pytest.raises(ValidationError):
        SignupRequest(email="test@example.com", username="tester", password="abc")

    # 2. Rejects common passwords (e.g. 12345678, password, qwerty123)
    with pytest.raises(ValidationError) as exc_info:
        SignupRequest(email="test@example.com", username="tester", password="password123")
    assert "too common and easily guessed" in str(exc_info.value)

    with pytest.raises(ValidationError) as exc_info:
        ChangePasswordRequest(current_password="old_password_123", new_password="password")
    assert "too common and easily guessed" in str(exc_info.value)

    # 3. Accepts strong unique password
    req = ChangePasswordRequest(current_password="old_password_123", new_password="CineSense!2026SecurePass")
    assert req.new_password == "CineSense!2026SecurePass"


def test_embedding_model_parity_self_check():
    res = verify_embedding_model_parity()
    assert res["status"] == "verified"
    assert res["cosine_similarity"] >= 0.999
    assert "all-MiniLM-L6-v2" in res["model"]


def test_translation_metrics_observability():
    stats = get_translation_stats()
    assert "success_count" in stats
    assert "failure_count" in stats
    assert "timeout_count" in stats
    assert "cache_size" in stats


@pytest.mark.asyncio
async def test_detailed_health_endpoint():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/health/detailed")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ["ok", "degraded"]
        assert "model_parity" in data
        assert data["model_parity"]["status"] == "verified"
        assert "translation" in data
        assert "faiss" in data


@pytest.mark.asyncio
async def test_recommend_catalog_fill_up_and_filter_notice():
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Kannada Action has catalog shortfall (<20) in local DB
        payload = {
            "mood_text": "action movies",
            "filters": {"genre_ids": [28], "original_language": "kn"},
            "limit": 20,
            "page": 1,
        }
        res = await ac.post("/recommend", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert len(data["recommendations"]) == 20
        assert data["filter_notice"] is not None
        assert "Kannada" in data["filter_notice"]
        # Strict matches are prioritized first
        assert data["recommendations"][0]["movie"]["original_language"] == "kn"

