import uuid
import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, String
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
    # ── 1. Check Intent ───────────────────────────────────────────────────────
    query_text = _build_query_text(payload.mood_text, payload.emotion_tags)
    
    from app.services.intent_service import classify_intent
    intent_resp = await classify_intent(query_text)
    intent_type = intent_resp.intent
    entities = intent_resp.entities
    logger.info(f"Intent classified: {intent_type} | Entities: {entities}")


    candidates_from_tmdb = []
    movies_in_db = {}
    candidate_ids = []
    score_map = {}

    # ── 2. Retrieval Strategies ────────────────────────────────────────────────
    if intent_type == "GENRE_FILTER":
        # Strategy: Direct SQL filtering on genres
        genre = entities.get("genre", "")
        # Very basic case-insensitive genre match in the JSONB array using text cast
        result = await db.execute(
            select(Movie)
            .where(Movie.genres.cast(String).ilike(f"%{genre}%"))
            .order_by(Movie.vote_average.desc().nullslast())
            .limit(100)
        )
        for m in result.scalars().all():
            candidate_ids.append(m.id)
            score_map[m.id] = float(m.vote_average or 0.0)
            movies_in_db[m.id] = m

    elif intent_type == "ACTOR_DIRECTOR":
        person_name = entities.get("person_name", payload.mood_text)
        role = entities.get("role", "unspecified")
        
        from sqlalchemy import and_
        conditions = []
        # We include a Movie.cast_crew.cast(String).ilike to hit the GIN trigram index for fast filtering,
        # and then further restrict it to the specific 'cast' or 'crew' array.
        fast_idx_cond = Movie.cast_crew.cast(String).ilike(f"%{person_name}%")
        
        if role in ["actor", "unspecified"]:
            conditions.append(and_(fast_idx_cond, Movie.cast_crew["cast"].astext.ilike(f"%{person_name}%")))
        if role in ["director", "unspecified"]:
            conditions.append(and_(fast_idx_cond, Movie.cast_crew["crew"].astext.ilike(f"%{person_name}%")))
            
        result = await db.execute(
            select(Movie)
            .where(or_(*conditions))
            .order_by(Movie.vote_average.desc().nullslast())
            .limit(50)
        )
        movies = result.scalars().all()
        if not movies:
            raise HTTPException(
                status_code=404,
                detail=f"No movies found for {person_name} in our current catalog."
            )
        for m in movies:
            candidate_ids.append(m.id)
            score_map[m.id] = float(m.vote_average or 0.0)
            movies_in_db[m.id] = m

    elif intent_type == "FRANCHISE":
        # Strategy: Fuzzy match against collection name in DB
        franchise_name = entities.get("franchise_name", payload.mood_text)
        result = await db.execute(
            select(Movie)
            .where(Movie.belongs_to_collection['name'].astext.ilike(f"%{franchise_name}%"))
            .order_by(Movie.release_date.asc().nullsfirst())
            .limit(50)
        )
        movies = result.scalars().all()
        for idx, m in enumerate(movies):
            candidate_ids.append(m.id)
            score_map[m.id] = 100.0 - idx  # Maintain chronological order
            movies_in_db[m.id] = m
            
        # If DB didn't have it, fallback to TMDB search would go here, 
        # but for brevity we rely on the backfilled DB

    elif intent_type == "SIMILAR_TO_MOVIE":
        # Strategy: Find reference movie in DB, get its embedding, do k-NN
        ref_title = entities.get("movie_title", payload.mood_text)
        
        # 1. Fuzzy match DB
        result = await db.execute(
            select(Movie).where(Movie.title.ilike(f"%{ref_title}%")).limit(1)
        )
        ref_movie = result.scalars().first()
        
        candidates = []
        if ref_movie and ref_movie.embedding_id is not None:
            # 2a. Found in DB: search FAISS using its exact vector
            logger.info(f"SIMILAR_TO_MOVIE: Found '{ref_movie.title}' in DB. Doing FAISS vector search.")
            ref_vec = faiss_service.get_movie_vector(ref_movie.embedding_id)
            if ref_vec is not None:
                candidates = faiss_service.search_by_vector(ref_vec, top_k=50)
        else:
            # 2b. Not in DB: Fetch TMDB live, embed overview, search FAISS
            logger.info(f"SIMILAR_TO_MOVIE: '{ref_title}' not in DB. Falling back to TMDB live + on-the-fly embedding.")
            from app.services.tmdb_service import _tmdb_get_async
            search_data = await _tmdb_get_async("/search/movie", {"query": ref_title})
            if search_data and search_data.get("results"):
                tmdb_ref = search_data["results"][0]
                overview = tmdb_ref.get("overview", "")
                if overview:
                    ref_vec = faiss_service.embed_text(overview)
                    candidates = faiss_service.search_by_vector(ref_vec, top_k=50)
        
        if candidates:
            candidate_ids = [movie_id for movie_id, _ in candidates]
            score_map = {movie_id: score for movie_id, score in candidates}
            db_result = await db.execute(select(Movie).where(Movie.id.in_(candidate_ids)))
            movies_in_db = {m.id: m for m in db_result.scalars().all()}

    # Fallback to standard MOOD if strategy yielded nothing or it was MOOD
    if not candidate_ids:
        # Strategy: Standard semantic search
        try:
            candidates = faiss_service.search(query_text, top_k=300)
        except RuntimeError as e:
            raise HTTPException(status_code=503, detail=str(e))

        if not candidates:
            raise HTTPException(status_code=404, detail="No candidates found. Is the FAISS index built?")

        candidate_ids = [movie_id for movie_id, _ in candidates]
        score_map = {movie_id: score for movie_id, score in candidates}

        # Fetch candidate movies from DB
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
    recommendations = []
    for i, m in enumerate(page_movies):
        exp = explanations[i] if i < len(explanations) else ""
        if not exp:
            genre_names = [g["name"] for g in (m.genres or [])][:2]
            if genre_names:
                genre_str = " and ".join(genre_names)
                exp = f"This {genre_str} film aligns with the mood you are looking for."
            else:
                exp = "A strong match for your current mood based on its emotional tone."
                
        recommendations.append(
            RecommendationItem(
                movie=MovieOut.model_validate(m),
                similarity_score=round(score_map.get(m.id, 0.0), 4),
                explanation=exp,
            )
        )

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
