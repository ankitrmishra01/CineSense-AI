import uuid
import logging
import asyncio
from datetime import date
import time
from typing import Optional, Any
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, String, func
from app.database import get_db
from app.models.user import User
from app.models.movie import Movie
from app.models.watchlist import Watchlist
from app.models.recommendation_session import RecommendationSession
from app.schemas.recommend import (
    RecommendRequest, RecommendResponse, RecommendationItem,
    ExplainRequest, ExplainResponse,
)
from app.schemas.movie import MovieOut
from app.dependencies import get_optional_user
from app.services import faiss_service, llm_service
from app.services.ranking_service import (
    calculate_match_percentage,
    compute_hybrid_score,
    extract_natural_constraints,
)
from app.services.explanation_service import generate_grounded_explanation

logger = logging.getLogger(__name__)

# Module-level cache for emergency TMDB movie hydration
_TMDB_FALLBACK_CACHE: dict[int, Movie] = {}

# Emotion tag → rich psychological and atmospheric descriptive text expansion
EMOTION_TAG_MAP = {
    "😢": "melancholy, deeply moving, poignant grief, sorrow, cathartic tears, emotional heartbreak, sadness, loss",
    "😂": "hilarious, witty humor, laugh-out-loud comedy, lighthearted fun, uplifting satire, cheerful banter, comedy",
    "😰": "tense edge-of-your-seat suspense, psychological thriller, intense anxiety, high stakes, panic, dread, paranoia",
    "🤗": "cozy, wholesome comfort, heartwarming family bond, gentle optimism, sweet friendship, feel-good solace, heartwarming",
    "😮": "jaw-dropping plot twist, surreal mind-bending revelation, unexpected shock, mystery, labyrinthine enigma, shocking",
    "🤔": "philosophical meditation, intellectual depth, existential dilemma, thought-provoking moral ambiguity, deep meaning",
    "😍": "passionate romance, intimate chemistry, sweeping love affair, tender longing, heartfelt devotion, true love",
    "😎": "stylish adrenaline action, high-octane spectacle, slick heist, cool swagger, unstoppable energy, exciting thrills",
    "😴": "gentle slow-burn tranquility, serene escapism, peaceful ambient stillness, meditative calm, relaxing gentle",
    "🔥": "relentless explosive intensity, epic heroic triumph, visceral warfare, raw adrenaline, chaotic power, epic",
    "👻": "chilling supernatural horror, eerie gothic dread, terrifying dark haunted nightmare, occult macabre, scary",
    "🌙": "dreamy poetic noir, ethereal atmospheric mood, shadowy midnight mystery, nostalgic reverie, atmospheric",
}


# Concurrency & Queue Guards:
# Bounded concurrency for heavy ONNX embedding & FAISS search (3 concurrent slots).
# Up to 8 requests can wait in the queue for up to 3.0 seconds.
# When the queue is saturated or wait exceeds 3 seconds, returns 503 with Retry-After: 2
_SEARCH_SEMAPHORE = asyncio.Semaphore(3)
_MAX_QUEUE_WAIT_SECONDS = 3.0
_QUEUE_DEPTH = 0
_MAX_QUEUE_DEPTH = 8
_QUEUE_LOCK = asyncio.Lock()


def get_adaptive_search_k(filters: Optional[Any], has_language_filter: bool = False) -> int:
    """Dynamically scales candidate pool size with filter strictness and language constraints."""
    if not filters:
        return 220 if has_language_filter else 80
    active = 0
    if getattr(filters, 'genre_ids', None):
        active += 1
    if getattr(filters, 'min_rating', None) is not None:
        active += 1
    if getattr(filters, 'max_runtime', None) is not None:
        active += 1
    if getattr(filters, 'min_year', None) is not None:
        active += 1
    if getattr(filters, 'original_language', None) or has_language_filter:
        active += 2

    if active == 0:
        return 100
    elif active == 1:
        return 180
    elif active == 2:
        return 280
    elif active == 3:
        return 380
    else:
        return 480


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
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    t_start = time.perf_counter()

    # Fast check: ensure FAISS and embedding model are warmed up
    if not faiss_service.is_loaded():
        try:
            faiss_service.preload()
        except Exception as e:
            logger.warning("FAISS engine warm-up pending: %s", e)
            raise HTTPException(
                status_code=503,
                detail="Recommendation engine is warming up. Please retry in a few seconds.",
                headers={"Retry-After": "5"},
            )

    # ── 1. Check Intent & Language ────────────────────────────────────────────
    query_text = _build_query_text(payload.mood_text, payload.emotion_tags)

    from app.services.language_service import translate_and_understand_query
    user_preferred_languages = (
        payload.preferred_languages or
        (current_user.preferred_languages if current_user and current_user.preferred_languages else None) or
        ["hi", "en"]
    )

    lang_insight = await translate_and_understand_query(query_text)
    translated_search_text = lang_insight.get("translated_text") or query_text
    explicit_language = lang_insight.get("explicit_language")
    regional_languages = lang_insight.get("regional_languages")

    if getattr(payload.filters, "original_language", None):
        explicit_language = payload.filters.original_language

    from app.services.intent_service import classify_intent
    intent_resp = await classify_intent(translated_search_text)
    intent_type = intent_resp.intent
    entities = intent_resp.entities
    t_intent_done = time.perf_counter()
    logger.info(f"Intent classified: {intent_type} | Lang: {explicit_language or 'mixed'} | Entities: {entities} in {(t_intent_done - t_start)*1000:.1f}ms")


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
        
        # Search cast_crew JSON using portable String casting (works in SQLite & Postgres GIN trigram)
        cast_crew_text = Movie.cast_crew.cast(String)
        conditions = [cast_crew_text.ilike(f"%{person_name}%")]
            
        result = await db.execute(
            select(Movie)
            .where(or_(*conditions))
            .order_by(Movie.vote_average.desc().nullslast())
            .limit(50)
        )
        movies = result.scalars().all()
        if movies:
            for m in movies:
                candidate_ids.append(m.id)
                score_map[m.id] = float(m.vote_average or 0.0)
                movies_in_db[m.id] = m
        else:
            logger.info("No actor/director match in DB for '%s'; falling back to FAISS semantic search.", person_name)

    elif intent_type == "FRANCHISE":
        # Strategy: Fuzzy match against collection name in DB
        franchise_name = entities.get("franchise_name", payload.mood_text)
        result = await db.execute(
            select(Movie)
            .where(Movie.belongs_to_collection.cast(String).ilike(f"%{franchise_name}%"))
            .order_by(Movie.release_date.asc().nullsfirst())
            .limit(50)
        )
        movies = result.scalars().all()
        if movies:
            for idx, m in enumerate(movies):
                candidate_ids.append(m.id)
                score_map[m.id] = 100.0 - idx  # Maintain chronological order
                movies_in_db[m.id] = m
        else:
            logger.info("No franchise match in DB for '%s'; falling back to FAISS semantic search.", franchise_name)
            
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
                candidates = await faiss_service.search_by_vector_async(ref_vec, top_k=50)
        else:
            # 2b. Not in DB: Fetch TMDB live, embed overview, search FAISS
            logger.info(f"SIMILAR_TO_MOVIE: '{ref_title}' not in DB. Falling back to TMDB live + on-the-fly embedding.")
            from app.services.tmdb_service import _tmdb_get_async
            search_data = await _tmdb_get_async("/search/movie", {"query": ref_title})
            if search_data and search_data.get("results"):
                tmdb_ref = search_data["results"][0]
                overview = tmdb_ref.get("overview", "")
                if overview:
                    ref_vec = await faiss_service.embed_text_async(overview)
                    candidates = await faiss_service.search_by_vector_async(ref_vec, top_k=50)
        
        if candidates:
            candidate_ids = [movie_id for movie_id, _ in candidates]
            score_map = {movie_id: score for movie_id, score in candidates}
            db_result = await db.execute(select(Movie).where(Movie.id.in_(candidate_ids)))
            movies_in_db = {m.id: m for m in db_result.scalars().all()}

    # Fallback to standard MOOD if strategy yielded nothing or it was MOOD
    if not candidate_ids:
        # ── Concurrency & Queue Protection ────────────────────────────────────
        # Bounded concurrency (semaphore = 3) with a short waiting queue (_MAX_QUEUE_DEPTH = 8).
        # Rejects excess load immediately with 503 + Retry-After instead of lagging 10 seconds.
        global _QUEUE_DEPTH
        async with _QUEUE_LOCK:
            if _QUEUE_DEPTH >= _MAX_QUEUE_DEPTH:
                logger.warning("Recommendation queue full (%d requests waiting). Returning 503.", _QUEUE_DEPTH)
                raise HTTPException(
                    status_code=503,
                    detail="The projection room is experiencing high demand. Please retry shortly.",
                    headers={"Retry-After": "2"},
                )
            _QUEUE_DEPTH += 1

        try:
            try:
                await asyncio.wait_for(_SEARCH_SEMAPHORE.acquire(), timeout=_MAX_QUEUE_WAIT_SECONDS)
            except asyncio.TimeoutError:
                logger.warning("Recommendation request timed out waiting in queue (>%.1fs). Returning 503.", _MAX_QUEUE_WAIT_SECONDS)
                raise HTTPException(
                    status_code=503,
                    detail="Recommendation request timed out in queue. Please retry shortly.",
                    headers={"Retry-After": "2"},
                )

            try:
                has_lang_filter = bool(explicit_language or regional_languages)
                search_k = get_adaptive_search_k(payload.filters, has_language_filter=has_lang_filter)
                candidates = await faiss_service.search_async(translated_search_text, top_k=search_k)
            except RuntimeError as e:
                raise HTTPException(
                    status_code=503,
                    detail=str(e),
                    headers={"Retry-After": "5"},
                )
            finally:
                _SEARCH_SEMAPHORE.release()
        finally:
            async with _QUEUE_LOCK:
                _QUEUE_DEPTH -= 1

        if not candidates:
            raise HTTPException(status_code=404, detail="No candidates found. Is the FAISS index built?")

        candidate_ids = [movie_id for movie_id, _ in candidates]
        score_map = {movie_id: score for movie_id, score in candidates}

        # 1. Query database for candidate movies
        db_has_movies = False
        movies_in_db = {}
        try:
            result = await db.execute(select(Movie).where(Movie.id.in_(candidate_ids)))
            movies_in_db = {m.id: m for m in result.scalars().all()}

            if movies_in_db:
                db_has_movies = True
            else:
                # Only check table count if zero candidate movies were found in local DB slice
                count_res = await db.execute(select(func.count(Movie.id)))
                total_db_count = count_res.scalar() or 0
                if total_db_count > 0:
                    db_has_movies = True
        except Exception as db_err:
            logger.warning("Database candidate lookup failed: %s", db_err)
            db_has_movies = False

        # 2. If DB is healthy and non-empty, PRODUCTION RESULT BUILDING MUST COME FROM THE DATABASE
        if db_has_movies:
            # We NEVER call TMDB when DB is healthy!
            if not movies_in_db:
                # If specific FAISS candidates are missing from local DB slice, fetch top titles from DB
                res = await db.execute(select(Movie).order_by(Movie.vote_average.desc().nullslast()).limit(50))
                for m in res.scalars().all():
                    movies_in_db[m.id] = m
                    if m.id not in candidate_ids:
                        candidate_ids.append(m.id)
                        score_map[m.id] = float(m.vote_average or 5.0) / 10.0
        else:
            # 3. Only when database is COMPLETELY UNAVAILABLE or EMPTY: Emergency TMDB fallback
            logger.warning("Database is completely unavailable or empty. Invoking emergency restricted TMDB fallback.")
            from app.services.tmdb_service import _tmdb_get_async

            async def _fetch_tmdb_movie_safe(mid: int) -> Optional[Movie]:
                if mid in _TMDB_FALLBACK_CACHE:
                    return _TMDB_FALLBACK_CACHE[mid]
                try:
                    # Strict 2.0s timeout per movie fetch
                    data = await asyncio.wait_for(_tmdb_get_async(f"/movie/{mid}"), timeout=2.0)
                    if data and "id" in data:
                        g_list = [{"id": g["id"], "name": g["name"]} for g in data.get("genres", []) if isinstance(g, dict)]
                        movie_obj = Movie(
                            id=data["id"],
                            title=data.get("title") or data.get("name") or "Unknown",
                            overview=data.get("overview", "") or "",
                            tagline=data.get("tagline"),
                            genres=g_list,
                            keywords=[],
                            poster_path=data.get("poster_path"),
                            backdrop_path=data.get("backdrop_path"),
                            runtime=data.get("runtime"),
                            vote_average=float(data.get("vote_average", 0.0) or 0.0),
                            vote_count=int(data.get("vote_count", 0) or 0),
                            release_date=None,
                            trailer_key=None,
                            watch_providers=None,
                            cast_crew=None,
                            belongs_to_collection=None,
                            embedding_id=None,
                        )
                        _TMDB_FALLBACK_CACHE[mid] = movie_obj
                        return movie_obj
                except Exception:
                    pass
                return None

            top_candidate_ids = candidate_ids[:12]  # At most 12 movies
            try:
                # Wrap the entire parallel fetch in a 2.5s maximum deadline
                fetched_movies = await asyncio.wait_for(
                    asyncio.gather(*[_fetch_tmdb_movie_safe(mid) for mid in top_candidate_ids]),
                    timeout=2.5
                )
                movies_in_db = {m.id: m for m in fetched_movies if m is not None}
            except asyncio.TimeoutError:
                logger.warning("Emergency TMDB fallback timed out after 2.5s")
                movies_in_db = {}

        if not movies_in_db:
            raise HTTPException(
                status_code=503,
                detail="Cinema catalog is temporarily unavailable or warming up. Please try again in a moment.",
                headers={"Retry-After": "5"},
            )

    t_retrieval_done = time.perf_counter()

    # ── 4. Apply filters & Natural Language Constraints ────────────────────────
    filters = payload.filters or {}
    natural_constraints = extract_natural_constraints(query_text)
    
    # Watchlist exclusion for authenticated users
    user_saved_movie_ids = set()
    if current_user:
        try:
            wl_result = await db.execute(select(Watchlist.movie_id).where(Watchlist.user_id == current_user.id))
            user_saved_movie_ids = set(wl_result.scalars().all())
        except Exception:
            pass

    filtered: list[Movie] = []

    for movie_id in candidate_ids:
        # Exclude saved movies if logged in
        if movie_id in user_saved_movie_ids:
            continue

        movie = movies_in_db.get(movie_id)
        if not movie:
            continue

        movie_genre_ids = [g["id"] for g in (movie.genres or []) if isinstance(g, dict)]

        # Explicit user genre filters
        if hasattr(filters, 'genre_ids') and filters.genre_ids:
            if not any(gid in movie_genre_ids for gid in filters.genre_ids):
                continue

        # Language constraints
        if explicit_language:
            if movie.original_language != explicit_language:
                continue
        elif regional_languages:
            if movie.original_language not in regional_languages:
                continue

        # Natural language negative genre filters ("no horror", etc.)
        if natural_constraints["exclude_genre_ids"]:
            if any(gid in movie_genre_ids for gid in natural_constraints["exclude_genre_ids"]):
                continue

        # Rating filter
        if hasattr(filters, 'min_rating') and filters.min_rating is not None:
            if not movie.vote_average or float(movie.vote_average) < filters.min_rating:
                continue

        # Runtime filter (explicit or natural)
        effective_max_runtime = getattr(filters, 'max_runtime', None) or natural_constraints["max_runtime"]
        if effective_max_runtime is not None:
            if movie.runtime and movie.runtime > effective_max_runtime:
                continue

        # Year filter (explicit or natural)
        min_year = getattr(filters, 'min_year', None) or natural_constraints["min_year"]
        if min_year is not None:
            if movie.release_date and movie.release_date.year < min_year:
                continue

        max_year = natural_constraints["max_year"]
        if max_year is not None:
            if movie.release_date and movie.release_date.year > max_year:
                continue

        # Filter out unreleased movies
        if movie.release_date and movie.release_date > date.today():
            continue

        filtered.append(movie)

    if not filtered:
        # Fallback 1: if user excluded watchlist items and hit 0, relax watchlist exclusion
        if user_saved_movie_ids:
            filtered = [m for m in movies_in_db.values() if not m.release_date or m.release_date <= date.today()]
        # Fallback 2: if strict language filter left 0 candidates, relax language filter
        if not filtered and (explicit_language or regional_languages):
            filtered = [m for m in movies_in_db.values() if not m.release_date or m.release_date <= date.today()]
        if not filtered:
            raise HTTPException(
                status_code=404,
                detail="No movies match the given filters. Try relaxing them.",
            )

    # ── 5. Hybrid Re-ranking ──────────────────────────────────────────────────
    filtered.sort(
        key=lambda m: compute_hybrid_score(
            similarity_score=score_map.get(m.id, 0.0),
            vote_average=float(m.vote_average) if m.vote_average else None,
            vote_count=m.vote_count,
            release_year=m.release_date.year if m.release_date else None,
            cohort_quality_score=float(m.cohort_quality_score) if m.cohort_quality_score else None,
            original_language=m.original_language,
            preferred_languages=user_preferred_languages,
        ),
        reverse=True
    )

    # Diversity re-ranking if user has multiple preferred languages and no explicit language filter
    if user_preferred_languages and len(user_preferred_languages) > 1 and not explicit_language and not regional_languages:
        from app.services.ranking_service import apply_diversity_rerank
        movie_items = [{"id": m.id, "original_language": m.original_language, "obj": m} for m in filtered]
        reranked_items = apply_diversity_rerank(movie_items, preferred_languages=user_preferred_languages, target_count=len(filtered))
        filtered = [item["obj"] for item in reranked_items]

    # Optional randomized shuffling for "Try again" functionality
    if payload.seed is not None:
        import random
        random.seed(payload.seed)
        top_n = min(len(filtered), 200)
        top_candidates = filtered[:top_n]
        random.shuffle(top_candidates)
        filtered = top_candidates + filtered[top_n:]

    # Pagination slicing
    total_results = len(filtered)
    total_pages = max(1, (total_results + payload.limit - 1) // payload.limit)
    page = max(1, min(payload.page, total_pages))
    
    start_idx = (page - 1) * payload.limit
    end_idx = start_idx + payload.limit
    page_movies = filtered[start_idx:end_idx]

    # ── 6. Build response with Grounded Explanations & Match % ─────────────────
    recommendations = []
    for m in page_movies:
        raw_score = score_map.get(m.id, 0.0)
        match_pct = calculate_match_percentage(raw_score)
        grounded_exp = generate_grounded_explanation(
            movie=m,
            query_text=query_text,
            similarity_score=raw_score,
            intent_type=intent_type,
        )
        recommendations.append(
            RecommendationItem(
                movie=MovieOut.model_validate(m),
                similarity_score=round(raw_score, 4),
                match_percentage=match_pct,
                explanation=grounded_exp,
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

    t_end = time.perf_counter()
    intent_dur = (t_intent_done - t_start) * 1000
    retrieval_dur = (t_retrieval_done - t_intent_done) * 1000
    rank_dur = (t_end - t_retrieval_done) * 1000
    total_dur = (t_end - t_start) * 1000

    response.headers["Server-Timing"] = (
        f"intent;dur={intent_dur:.1f}, "
        f"retrieval;dur={retrieval_dur:.1f}, "
        f"rank;dur={rank_dur:.1f}, "
        f"total;dur={total_dur:.1f}"
    )
    logger.info(
        "PERF recommend: total=%.1fms (intent=%.1fms, retrieval=%.1fms, rank=%.1fms)",
        total_dur, intent_dur, retrieval_dur, rank_dur,
    )

    return RecommendResponse(
        session_id=session_id,
        query_summary=_summarize_query(payload.mood_text, payload.emotion_tags),
        total_results=total_results,
        total_pages=total_pages,
        current_page=page,
        recommendations=recommendations,
    )


@router.post("/recommend/explain", response_model=ExplainResponse)
async def explain_recommendation(payload: ExplainRequest, db: AsyncSession = Depends(get_db)):
    """
    On-demand rich explanation endpoint called lazily when user clicks 'Why this?'.
    Never blocks primary recommendations response.
    """
    result = await db.execute(select(Movie).where(Movie.id == payload.movie_id))
    movie = result.scalar_one_or_none()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    genres = [g["name"] for g in (movie.genres or []) if isinstance(g, dict)]
    context = llm_service.MovieContext(
        title=movie.title,
        overview=movie.overview,
        tagline=movie.tagline,
        genres=genres,
        vote_average=float(movie.vote_average) if movie.vote_average else None,
        release_year=movie.release_date.year if movie.release_date else None,
    )

    try:
        exps = await llm_service.generate_explanations(payload.query_text, [context])
        rich_exp = exps[0] if exps and exps[0] else generate_grounded_explanation(movie, payload.query_text)
    except Exception:
        rich_exp = generate_grounded_explanation(movie, payload.query_text)

    return ExplainResponse(movie_id=payload.movie_id, explanation=rich_exp)

