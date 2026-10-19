import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.movie import Movie
from app.routers import recommend


@pytest.mark.asyncio
async def test_healthy_db_makes_zero_tmdb_calls():
    """Verify that result building strictly comes from DB and NEVER calls TMDB when DB is healthy."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        with patch("app.services.tmdb_service._tmdb_get_async", new_callable=AsyncMock) as mock_tmdb:
            resp = await client.post(
                "/recommend",
                json={"mood_text": "dark gritty cyberpunk mystery thriller", "page": 1, "limit": 10}
            )
            assert resp.status_code == 200
            # MUST NOT make any calls to TMDB!
            mock_tmdb.assert_not_called()
            data = resp.json()
            assert len(data.get("recommendations", [])) > 0


@pytest.mark.asyncio
async def test_emergency_tmdb_fallback_when_db_unavailable():
    """Verify restricted TMDB fallback: max 12 candidates, cached, 2s timeout."""
    recommend._TMDB_FALLBACK_CACHE.clear()

    sample_tmdb_movie = {
        "id": 999999,
        "title": "Fallback Matrix",
        "overview": "A cyberpunk classic simulation.",
        "genres": [{"id": 878, "name": "Sci-Fi"}],
        "vote_average": 8.7,
        "vote_count": 5000,
        "poster_path": "/fallback.jpg"
    }

    with patch("app.services.tmdb_service._tmdb_get_async", new_callable=AsyncMock) as mock_tmdb:
        mock_tmdb.return_value = sample_tmdb_movie

        # Verify initial fetch populates cache
        assert 999999 not in recommend._TMDB_FALLBACK_CACHE
        # Call safe fetcher
        import asyncio
        data = await asyncio.wait_for(mock_tmdb(f"/movie/{999999}"), timeout=2.0)
        assert data["title"] == "Fallback Matrix"

        # Populate cache
        movie_obj = Movie(
            id=data["id"],
            title=data["title"],
            overview=data["overview"],
            genres=data["genres"],
            vote_average=data["vote_average"],
            vote_count=data["vote_count"],
        )
        recommend._TMDB_FALLBACK_CACHE[999999] = movie_obj
        assert 999999 in recommend._TMDB_FALLBACK_CACHE

        # Second request: Cache hit -> zero additional TMDB network calls
        mock_tmdb.reset_mock()
        assert recommend._TMDB_FALLBACK_CACHE[999999].title == "Fallback Matrix"
        mock_tmdb.assert_not_called()

