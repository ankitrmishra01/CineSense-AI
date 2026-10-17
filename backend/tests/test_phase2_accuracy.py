import pytest
from datetime import date
from app.models.movie import Movie
from app.services.ranking_service import (
    calculate_match_percentage,
    compute_hybrid_score,
    extract_natural_constraints,
)
from app.services.explanation_service import generate_grounded_explanation

def test_match_percentage_bounds_and_values():
    # Min bound clamp
    assert calculate_match_percentage(0.10) == 60
    # Mid-range
    mid = calculate_match_percentage(0.50)
    assert 75 <= mid <= 85
    # High match
    high = calculate_match_percentage(0.75)
    assert 92 <= high <= 99
    # Clamp max
    assert calculate_match_percentage(0.95) == 99

def test_compute_hybrid_score_favors_credible_titles():
    # Movie A: high vector match (0.8), high vote count (5000), great rating (8.5)
    score_a = compute_hybrid_score(
        similarity_score=0.8,
        vote_average=8.5,
        vote_count=5000,
        release_year=2020,
    )
    # Movie B: obscure movie with low vote count (10), same vector match
    score_b = compute_hybrid_score(
        similarity_score=0.8,
        vote_average=8.5,
        vote_count=10,
        release_year=2020,
    )
    # Movie A should rank significantly higher than obscure Movie B
    assert score_a > score_b

def test_extract_natural_constraints():
    # Negative genre
    c1 = extract_natural_constraints("want something fun with no horror")
    assert 27 in c1["exclude_genre_ids"]  # Horror ID is 27

    # Runtime in hours
    c2 = extract_natural_constraints("looking for an exciting action film under 2 hours")
    assert c2["max_runtime"] == 120

    # Runtime in minutes
    c3 = extract_natural_constraints("quick comfort movie under 90 minutes")
    assert c3["max_runtime"] == 90

    # Era constraint
    c4 = extract_natural_constraints("great comedy from the 90s")
    assert c4["min_year"] == 1990
    assert c4["max_year"] == 1999

def test_grounded_explanation_generation():
    movie = Movie(
        id=550,
        title="Fight Club",
        overview="An insomniac office worker looking for a way to change his life crosses paths with a devil-may-care soap maker.",
        tagline="Mischief. Mayhem. Soap.",
        genres=[{"id": 18, "name": "Drama"}],
        keywords=["insomnia", "anarchy", "subconscious", "anti-establishment"],
        vote_average=8.4,
        release_date=date(1999, 10, 15),
    )
    exp = generate_grounded_explanation(
        movie=movie,
        query_text="I'm feeling stuck and want something mind-bending and thought-provoking",
        similarity_score=0.72,
        intent_type="MOOD"
    )
    assert len(exp) > 20
    assert "Drama" in exp or "drama" in exp or "soap" in exp or "subconscious" in exp
