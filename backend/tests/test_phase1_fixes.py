import pytest
from app.services.rate_limiter import InMemoryRateLimiter
from app.services.intent_service import _quick_rule_classify
from app.schemas.auth import TokenRefreshResponse
from app.schemas.movie import MovieOut
from app.database import engine

def test_rate_limiter_allows_and_blocks():
    limiter = InMemoryRateLimiter(max_requests=3, window_seconds=10)
    client_id = "test_client_1"
    
    assert limiter.is_allowed(client_id)[0] is True
    assert limiter.is_allowed(client_id)[0] is True
    assert limiter.is_allowed(client_id)[0] is True
    
    allowed, retry_after = limiter.is_allowed(client_id)
    assert allowed is False
    assert retry_after > 0

def test_intent_rule_based_classifier():
    # Similar to movie
    res = _quick_rule_classify("movies like Interstellar")
    assert res is not None
    assert res.intent == "SIMILAR_TO_MOVIE"
    assert res.entities["movie_title"] == "Interstellar"

    # Director
    res = _quick_rule_classify("directed by Christopher Nolan")
    assert res is not None
    assert res.intent == "ACTOR_DIRECTOR"
    assert res.entities["person_name"] == "Christopher Nolan"
    assert res.entities["role"] == "director"

    # Actor
    res = _quick_rule_classify("movies with Tom Hanks")
    assert res is not None
    assert res.intent == "ACTOR_DIRECTOR"
    assert res.entities["person_name"] == "Tom Hanks"
    assert res.entities["role"] == "actor"

    # Franchise
    res = _quick_rule_classify("all Harry Potter movies")
    assert res is not None
    assert res.intent == "FRANCHISE"
    assert "Harry Potter" in res.entities["franchise_name"]

    # Mood emoji
    res = _quick_rule_classify("sad, heartbroken, grieving")
    assert res is not None
    assert res.intent == "MOOD"

def test_token_refresh_response_schema():
    resp = TokenRefreshResponse(access_token="new_access", refresh_token="new_refresh")
    assert resp.access_token == "new_access"
    assert resp.refresh_token == "new_refresh"
    assert resp.token_type == "bearer"

def test_movie_out_schema_includes_cast_crew_and_collection():
    movie_dict = {
        "id": 101,
        "title": "Interstellar",
        "cast_crew": {"cast": [{"id": 1, "name": "Matthew McConaughey"}]},
        "belongs_to_collection": {"id": 999, "name": "Nolan Sci-Fi"},
    }
    out = MovieOut.model_validate(movie_dict)
    assert out.id == 101
    assert out.cast_crew["cast"][0]["name"] == "Matthew McConaughey"
    assert out.belongs_to_collection["name"] == "Nolan Sci-Fi"

def test_database_engine_resilience_settings():
    from app.database import is_sqlite
    if not is_sqlite:
        assert engine.pool._pre_ping is True
        assert engine.pool._recycle == 300
    else:
        assert engine is not None

