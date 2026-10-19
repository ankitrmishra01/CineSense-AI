import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from app.services.tmdb_service import (
    extract_best_trailer,
    extract_watch_providers,
    extract_cast_and_crew,
    get_live_movie_details_async,
    _movie_details_cache,
    _details_inflight,
)
from app.schemas.movie import MovieOut

# ---------------------------------------------------------------------------
# 1. Trailer Selection Rules
# ---------------------------------------------------------------------------

def test_trailer_choice_rules():
    # Scenario A: Official trailer in preferred language beats official English trailer
    videos_sample = {
        "results": [
            {"site": "YouTube", "type": "Teaser", "official": True, "key": "teaser_en", "iso_639_1": "en"},
            {"site": "YouTube", "type": "Trailer", "official": False, "key": "trailer_unofficial", "iso_639_1": "hi"},
            {"site": "YouTube", "type": "Trailer", "official": True, "key": "trailer_en", "iso_639_1": "en", "name": "English Trailer"},
            {"site": "YouTube", "type": "Trailer", "official": True, "key": "trailer_hi", "iso_639_1": "hi", "name": "Hindi Trailer"},
            {"site": "Vimeo", "type": "Trailer", "official": True, "key": "vimeo_key"},
        ]
    }

    # With Hindi preferred:
    key, name = extract_best_trailer(videos_sample, preferred_language="hi")
    assert key == "trailer_hi"
    assert name == "Hindi Trailer"

    # With English preferred or default:
    key_en, name_en = extract_best_trailer(videos_sample, preferred_language="en")
    assert key_en == "trailer_en"

    # Scenario B: Fallback to teaser if no trailer exists
    teasers_only = {
        "results": [
            {"site": "YouTube", "type": "Clip", "official": True, "key": "clip_key", "name": "Clip 1"},
            {"site": "YouTube", "type": "Teaser", "official": True, "key": "teaser_key", "name": "Official Teaser"},
        ]
    }
    key_teaser, name_teaser = extract_best_trailer(teasers_only)
    assert key_teaser == "teaser_key"
    assert name_teaser == "Official Teaser"

    # Scenario C: Empty / invalid
    assert extract_best_trailer(None) == (None, None)
    assert extract_best_trailer({"results": []}) == (None, None)


# ---------------------------------------------------------------------------
# 2. Watch Providers Grouping & Region Fallback
# ---------------------------------------------------------------------------

def test_watch_providers_grouping_and_fallback():
    # Scenario A: IN has data -> picks IN
    providers_sample_in = {
        "results": {
            "IN": {
                "link": "https://tmdb.org/watch?locale=IN",
                "flatrate": [{"provider_id": 8, "provider_name": "Netflix", "logo_path": "/n.png"}],
                "rent": [{"provider_id": 2, "provider_name": "Apple TV", "logo_path": "/a.png"}],
                "buy": [],
            },
            "US": {
                "link": "https://tmdb.org/watch?locale=US",
                "flatrate": [{"provider_id": 15, "provider_name": "Hulu", "logo_path": "/h.png"}],
            }
        }
    }
    res_in = extract_watch_providers(providers_sample_in)
    assert res_in["region_code"] == "IN"
    assert res_in["region_label"] == "India"
    assert len(res_in["stream"]) == 1
    assert res_in["stream"][0]["provider_name"] == "Netflix"
    assert len(res_in["rent"]) == 1
    assert len(res_in["buy"]) == 0
    assert res_in["attribution"] == "Streaming data by JustWatch"
    assert res_in["has_providers"] is True

    # Scenario B: IN is empty -> falls back to US
    providers_sample_us = {
        "results": {
            "IN": {"flatrate": [], "rent": [], "buy": []},
            "US": {
                "link": "https://tmdb.org/watch?locale=US",
                "flatrate": [{"provider_id": 15, "provider_name": "Hulu", "logo_path": "/h.png"}],
                "rent": [],
                "buy": [{"provider_id": 2, "provider_name": "Apple TV", "logo_path": "/a.png"}],
            }
        }
    }
    res_us = extract_watch_providers(providers_sample_us)
    assert res_us["region_code"] == "US"
    assert res_us["region_label"] == "United States"
    assert res_us["stream"][0]["provider_name"] == "Hulu"
    assert res_us["has_providers"] is True

    # Scenario C: Completely empty
    res_empty = extract_watch_providers(None)
    assert res_empty["region_code"] == "IN"
    assert res_empty["has_providers"] is False
    assert res_empty["stream"] == []


# ---------------------------------------------------------------------------
# 3. Cast & Crew Trimming
# ---------------------------------------------------------------------------

def test_cast_and_crew_extraction():
    credits_sample = {
        "cast": [
            {"id": i, "name": f"Actor {i}", "character": f"Char {i}", "profile_path": f"/p{i}.jpg", "order": i}
            for i in range(25)
        ],
        "crew": [
            {"id": 100, "name": "Jane Director", "job": "Director", "profile_path": "/jd.jpg"},
            {"id": 101, "name": "John Producer", "job": "Producer", "profile_path": "/jp.jpg"},
        ]
    }
    extracted = extract_cast_and_crew(credits_sample)
    # Strictly trimmed to top 10
    assert len(extracted["cast"]) == 10
    assert extracted["cast"][0]["name"] == "Actor 0"
    assert extracted["cast"][9]["name"] == "Actor 9"
    # Directors extracted
    assert len(extracted["crew"]) == 1
    assert extracted["crew"][0]["name"] == "Jane Director"
    assert extracted["directors"] == ["Jane Director"]


# ---------------------------------------------------------------------------
# 4. Live Hydration Cache & De-duplication
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_live_hydration_cache_and_deduplication():
    _movie_details_cache.clear()
    _details_inflight.clear()

    mock_response_data = {
        "id": 999999,
        "title": "Test Hydrated Film",
        "overview": "Overview here",
        "videos": {"results": [{"site": "YouTube", "type": "Trailer", "official": True, "key": "test_key", "name": "Official Trailer"}]},
        "watch/providers": {"results": {"IN": {"flatrate": [{"provider_name": "JioCinema", "logo_path": "/jio.png"}]}}},
        "credits": {
            "cast": [{"id": 1, "name": "Lead Actor", "character": "Protagonist", "profile_path": "/a.jpg"}],
            "crew": [{"id": 2, "name": "Lead Director", "job": "Director"}]
        },
        "similar": {"results": []}
    }

    with patch("httpx.AsyncClient.get") as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_response_data
        mock_get.return_value = mock_resp

        # First call: makes outbound TMDB call
        res1 = await get_live_movie_details_async(999999)
        assert res1 is not None
        assert res1["trailer_key"] == "test_key"
        assert res1["watch_providers"]["stream"][0]["provider_name"] == "JioCinema"
        assert mock_get.call_count == 1

        # Second call: hits cache, does NOT call TMDB again
        res2 = await get_live_movie_details_async(999999)
        assert res2["trailer_key"] == "test_key"
        assert mock_get.call_count == 1  # Unchanged!


@pytest.mark.asyncio
async def test_live_hydration_timeout_fallback_to_none():
    _movie_details_cache.clear()
    _details_inflight.clear()

    # Simulate timeout on TMDB endpoint
    with patch("httpx.AsyncClient.get", side_effect=asyncio.TimeoutError("TMDB Timeout")):
        res = await get_live_movie_details_async(888888)
        # Gracefully returns None, never crashes
        assert res is None


# ---------------------------------------------------------------------------
# 5. Schema Validation & Safe Serialization
# ---------------------------------------------------------------------------

def test_movie_out_schema_with_trailer_and_providers():
    movie = MovieOut(
        id=1051896,
        title="Arcadian",
        trailer_key="HNARuSROxbM",
        trailer_name="Official Trailer",
        watch_providers={
            "region_code": "IN",
            "region_label": "India",
            "stream": [{"provider_name": "Lionsgate Play", "logo_path": "/l.png"}],
            "attribution": "Streaming data by JustWatch",
        },
        cast_crew={
            "cast": [{"id": 1, "name": "Nicolas Cage", "character": "Paul"}],
            "directors": ["Benjamin Brewer"]
        }
    )
    data = movie.model_dump()
    assert data["id"] == 1051896
    assert data["trailer_key"] == "HNARuSROxbM"
    assert data["trailer_name"] == "Official Trailer"
    assert data["watch_providers"]["region_code"] == "IN"
    assert data["cast_crew"]["directors"] == ["Benjamin Brewer"]
