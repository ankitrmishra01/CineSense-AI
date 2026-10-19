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
        return 500 if has_language_filter else 350
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
        return 350
    elif active == 1:
        return 450
    elif active == 2:
        return 550
    elif active == 3:
        return 650
    else:
        return 800


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
            .limit(100)
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
            .limit(100)
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
                candidates = await faiss_service.search_by_vector_async(ref_vec, top_k=150)
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
                    candidates = await faiss_service.search_by_vector_async(ref_vec, top_k=150)
        
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

    target_needed = max(payload.page * payload.limit, payload.limit)
    stage_relaxation_applied = []
    filter_notice = None

    def _eval_movie(
        m: Movie,
        check_genre: bool = True,
        check_rating: bool = True,
        check_runtime: bool = True,
        check_year: bool = True,
        check_language: bool = True,
    ) -> bool:
        movie_genre_ids = [g["id"] for g in (m.genres or []) if isinstance(g, dict)]
        if check_genre:
            if hasattr(filters, 'genre_ids') and filters.genre_ids:
                if not any(gid in movie_genre_ids for gid in filters.genre_ids):
                    return False
            if natural_constraints["exclude_genre_ids"]:
                if any(gid in movie_genre_ids for gid in natural_constraints["exclude_genre_ids"]):
                    return False
        if check_rating and hasattr(filters, 'min_rating') and filters.min_rating is not None:
            if not m.vote_average or float(m.vote_average) < filters.min_rating:
                return False
        if check_runtime:
            effective_max_runtime = getattr(filters, 'max_runtime', None) or natural_constraints["max_runtime"]
            if effective_max_runtime is not None:
                if m.runtime and m.runtime > effective_max_runtime:
                    return False
        if check_year:
            min_year = getattr(filters, 'min_year', None) or natural_constraints["min_year"]
            if min_year is not None and m.release_date and m.release_date.year < min_year:
                return False
            max_year = natural_constraints["max_year"]
            if max_year is not None and m.release_date and m.release_date.year > max_year:
                return False
        if m.release_date and m.release_date > date.today():
            return False
        if check_language:
            if explicit_language:
                if m.original_language != explicit_language:
                    return False
            elif regional_languages:
                if m.original_language not in regional_languages:
                    return False
        return True

    # Initial strict filtering
    filtered: list[Movie] = []
    candidates_matching_non_lang: list[Movie] = []

    for movie_id in candidate_ids:
        if movie_id in user_saved_movie_ids:
            continue
        movie = movies_in_db.get(movie_id)
        if not movie:
            continue
        if _eval_movie(movie, check_language=False):
            candidates_matching_non_lang.append(movie)
        if _eval_movie(movie, check_language=True):
            filtered.append(movie)

    stage_strict_count = len(filtered)

    # ── Step 1: Widen FAISS search_k if candidate pool is small ───────────────
    if len(filtered) < target_needed and len(candidate_ids) < 1000:
        logger.info(
            "Candidate count (%d) below target (%d). Widening search_k to 1500.",
            len(filtered), target_needed
        )
        stage_relaxation_applied.append("widen_search_k_1500")
        try:
            wider_candidates = await faiss_service.search_async(translated_search_text, top_k=1500)
            new_ids = [mid for mid, _ in wider_candidates if mid not in movies_in_db]
            if new_ids:
                res = await db.execute(select(Movie).where(Movie.id.in_(new_ids)))
                for m in res.scalars().all():
                    movies_in_db[m.id] = m
            for mid, sc in wider_candidates:
                if mid not in score_map:
                    score_map[mid] = sc
            candidate_ids = [mid for mid, _ in wider_candidates]

            # Re-evaluate with wider candidates
            filtered = []
            candidates_matching_non_lang = []
            for movie_id in candidate_ids:
                if movie_id in user_saved_movie_ids:
                    continue
                movie = movies_in_db.get(movie_id)
                if not movie:
                    continue
                if _eval_movie(movie, check_language=False):
                    candidates_matching_non_lang.append(movie)
                if _eval_movie(movie, check_language=True):
                    filtered.append(movie)
            stage_strict_count = len(filtered)
        except Exception as widen_err:
            logger.warning("Failed to widen FAISS candidates: %s", widen_err)

    # ── Step 2: Soft floor relaxation (rating / runtime / year) ───────────────
    if len(filtered) < target_needed:
        relaxed_matches = []
        for movie_id in candidate_ids:
            if movie_id in user_saved_movie_ids:
                continue
            movie = movies_in_db.get(movie_id)
            if not movie:
                continue
            # Relax rating and runtime constraints
            if _eval_movie(movie, check_genre=True, check_rating=False, check_runtime=False, check_year=False, check_language=True):
                relaxed_matches.append(movie)
        if len(relaxed_matches) > len(filtered):
            stage_relaxation_applied.append("soft_floor_relaxation")
            filtered = relaxed_matches
            filter_notice = "Relaxed rating and duration filters to show more titles."

    # ── Step 3: Catalog fill-up with notice if matches are catalog-limited ─────
    strict_match_count = len(filtered)
    if len(filtered) < target_needed:
        stage_relaxation_applied.append("catalog_limit_fill_up")
        existing_ids = {m.id for m in filtered}

        # 1st priority fillers: matches adhering to mood/genres in other languages
        fillers = [m for m in candidates_matching_non_lang if m.id not in existing_ids]

        # 2nd priority fillers: top semantic matches in database
        if len(filtered) + len(fillers) < target_needed:
            general_hydrated = sorted(
                [
                    m for m in movies_in_db.values()
                    if m.id not in existing_ids and m not in fillers and (not m.release_date or m.release_date <= date.today())
                ],
                key=lambda m: score_map.get(m.id, 0.0),
                reverse=True
            )
            fillers.extend(general_hydrated)

        shortfall = target_needed - len(filtered)
        filtered.extend(fillers[:shortfall])

        from app.services.language_service import LANGUAGE_METADATA
        if explicit_language:
            lang_label = LANGUAGE_METADATA.get(explicit_language, {}).get("name", explicit_language.upper())
            filter_notice = f"Found {strict_match_count} {lang_label} titles matching your criteria. Showing related recommendations to complete your list."
        elif regional_languages:
            filter_notice = f"Found {strict_match_count} titles matching your regional filters. Showing related recommendations to complete your list."
        else:
            filter_notice = f"Found {strict_match_count} titles matching all criteria. Showing related recommendations to complete your list."

    if not filtered:
        # Ultimate fallback to top catalog movies so user is never stranded
        filtered = list(movies_in_db.values())[:payload.limit]
        filter_notice = "Showing popular recommendations based on your query."

    # ── 5. Hybrid Re-ranking ──────────────────────────────────────────────────
    def _movie_score(m: Movie) -> float:
        return compute_hybrid_score(
            similarity_score=score_map.get(m.id, 0.0),
            vote_average=float(m.vote_average) if m.vote_average else None,
            vote_count=m.vote_count,
            release_year=m.release_date.year if m.release_date else None,
            cohort_quality_score=float(m.cohort_quality_score) if m.cohort_quality_score else None,
            original_language=m.original_language,
            preferred_languages=user_preferred_languages,
        )

    if strict_match_count > 0 and len(filtered) > strict_match_count:
        strict_portion = filtered[:strict_match_count]
        filler_portion = filtered[strict_match_count:]
        strict_portion.sort(key=_movie_score, reverse=True)
        filler_portion.sort(key=_movie_score, reverse=True)
        filtered = strict_portion + filler_portion
    else:
        filtered.sort(key=_movie_score, reverse=True)

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

    pipeline_debug = {
        "stage_faiss_raw": len(candidate_ids),
        "stage_db_hydrated": len(movies_in_db),
        "stage_strict_initial": stage_strict_count,
        "stage_relaxation_applied": stage_relaxation_applied,
        "stage_final_count": len(filtered),
        "page_movies_count": len(page_movies),
    }
    logger.info("Recommendation pipeline stages: %s", pipeline_debug)

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

    from collections import Counter
    lang_counts = Counter(m.original_language for m in candidates_matching_non_lang if m.original_language)

    return RecommendResponse(
        session_id=session_id,
        query_summary=_summarize_query(payload.mood_text, payload.emotion_tags),
        total_results=total_results,
        total_pages=total_pages,
        current_page=page,
        recommendations=recommendations,
        available_languages=dict(lang_counts.most_common(14)),
        filter_notice=filter_notice,
        pipeline_debug=pipeline_debug,
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

