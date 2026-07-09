import uuid
import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.database import get_db
from app.models.user import User
from app.models.movie import Movie
from app.models.recommendation_session import RecommendationSession
from app.schemas.recommend import RecommendRequest, RecommendResponse, RecommendationItem
from app.schemas.movie import MovieOut
from app.dependencies import get_optional_user
from app.services import faiss_service, llm_service

logger = logging.getLogger(__name__)

# Emotion tag → descriptive text expansion
EMOTION_TAG_MAP = {
    "😢": "sad, heartbroken, grieving",
    "😂": "happy, funny, laughing, comedy",
    "😰": "anxious, stressed, tense, suspenseful",
    "🤗": "warm, comforting, cozy, heartwarming",
    "😮": "surprised, mind-blowing, plot twist, shocking",
    "🤔": "thought-provoking, intellectual, philosophical",
    "😍": "romantic, love story, passionate",
    "😎": "cool, action-packed, thrilling, stylish",
    "😴": "relaxing, slow-paced, gentle, calm",
    "🔥": "intense, exciting, adrenaline, epic",
    "👻": "scary, horror, supernatural, eerie",
    "🌙": "dreamy, atmospheric, mysterious, melancholic",
}

router = APIRouter(tags=["Recommendations"])


def _build_query_text(mood_text: Optional[str], emotion_tags: Optional[list[str]]) -> str:
    parts = []
    if mood_text:
        parts.append(mood_text)
    if emotion_tags:
        expansions = [EMOTION_TAG_MAP.get(tag, tag) for tag in emotion_tags]
        parts.append(", ".join(expansions))
    return " ".join(parts)


def _summarize_query(mood_text: Optional[str], emotion_tags: Optional[list[str]]) -> str:
    if mood_text:
        return mood_text[:80] + ("..." if len(mood_text) > 80 else "")
    if emotion_tags:
        return " ".join(emotion_tags)
    return "Your mood"


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(
    payload: RecommendRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    # ── 1. Build query text ────────────────────────────────────────────────────
    query_text = _build_query_text(payload.mood_text, payload.emotion_tags)

    # ── 2. FAISS k-NN search (overfetch) ──────────────────────────────────────
    try:
        candidates = faiss_service.search(query_text, top_k=300)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if not candidates:
        raise HTTPException(status_code=404, detail="No candidates found. Is the FAISS index built?")

    candidate_ids = [movie_id for movie_id, _ in candidates]
    score_map = {movie_id: score for movie_id, score in candidates}

    # ── 3. Fetch candidate movies from DB ─────────────────────────────────────
    result = await db.execute(select(Movie).where(Movie.id.in_(candidate_ids)))
    movies_in_db = {m.id: m for m in result.scalars().all()}

    # ── 4. Apply filters ───────────────────────────────────────────────────────
    filters = payload.filters or {}
    filtered: list[Movie] = []

    for movie_id in candidate_ids:
        movie = movies_in_db.get(movie_id)
        if not movie:
            continue

        if hasattr(filters, 'genre_ids') and filters.genre_ids:
            movie_genre_ids = [g["id"] for g in (movie.genres or [])]
            if not any(gid in movie_genre_ids for gid in filters.genre_ids):
                continue

        if hasattr(filters, 'min_rating') and filters.min_rating is not None:
            if not movie.vote_average or float(movie.vote_average) < filters.min_rating:
                continue

        if hasattr(filters, 'max_runtime') and filters.max_runtime is not None:
            if movie.runtime and movie.runtime > filters.max_runtime:
                continue

        if hasattr(filters, 'min_year') and filters.min_year is not None:
            if movie.release_date and movie.release_date.year < filters.min_year:
                continue

        # Filter out unreleased movies
        if movie.release_date and movie.release_date > date.today():
            continue

        filtered.append(movie)

    if not filtered:
        raise HTTPException(
            status_code=404,
            detail="No movies match the given filters. Try relaxing them.",
        )

    # Sort by similarity score
    filtered.sort(key=lambda m: score_map.get(m.id, 0), reverse=True)

    # Optional randomized shuffling for "Try again" functionality
    if payload.seed is not None:
        import random
        random.seed(payload.seed)
        # We only shuffle the top 200 candidates to maintain high relevance while mixing them up
        top_n = min(len(filtered), 200)
        top_candidates = filtered[:top_n]
        random.shuffle(top_candidates)
        filtered = top_candidates + filtered[top_n:]

    # Pagination slicing
    total_results = len(filtered)
    total_pages = max(1, (total_results + payload.limit - 1) // payload.limit)
    page = min(payload.page, total_pages)
    
    start_idx = (page - 1) * payload.limit
    end_idx = start_idx + payload.limit
    page_movies = filtered[start_idx:end_idx]

    # ── 5. Batched LLM call ────────────────────────────────────────────────────
    movie_contexts = [
        llm_service.MovieContext(
            title=m.title,
            overview=m.overview,
            tagline=m.tagline,
            genres=[g["name"] for g in (m.genres or [])],
            vote_average=float(m.vote_average) if m.vote_average else None,
            release_year=m.release_date.year if m.release_date else None,
        )
        for m in page_movies
    ]
    explanations = await llm_service.generate_explanations(query_text, movie_contexts)

    # ── 6. Build response ─────────────────────────────────────────────────────
    recommendations = [
        RecommendationItem(
            movie=MovieOut.model_validate(m),
            similarity_score=round(score_map.get(m.id, 0.0), 4),
            explanation=explanations[i] or f"A great match for your mood.",
        )
        for i, m in enumerate(page_movies)
    ]

    # ── 7. Persist session (authenticated users only) ─────────────────────────
    session_id = None
    if current_user:
        session = RecommendationSession(
            user_id=current_user.id,
            mood_text=payload.mood_text,
            emotion_tags=payload.emotion_tags,
            filters=payload.filters.model_dump() if payload.filters else None,
            result_movie_ids=[m.id for m in page_movies],
        )
        db.add(session)
        await db.flush()
        session_id = session.id

    return RecommendResponse(
        session_id=session_id,
        query_summary=_summarize_query(payload.mood_text, payload.emotion_tags),
        total_results=total_results,
        total_pages=total_pages,
        current_page=page,
        recommendations=recommendations,
    )
