#!/usr/bin/env python3
"""
build_embeddings.py — Generate FAISS index from movie embeddings
Uses sentence-transformers (all-MiniLM-L6-v2) to embed each movie's
overview + tagline + keywords, then builds a FAISS IndexFlatIP index.

Usage:
    cd backend
    python scripts/build_embeddings.py

Output:
    faiss_index/movies.index  — FAISS binary index
    faiss_index/id_map.json   — list mapping embedding_id → movie_id
"""
import os
import sys
import json
import logging
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

import numpy as np
from tqdm import tqdm
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models.movie import Movie

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

INDEX_DIR = Path(settings.FAISS_INDEX_PATH).parent
INDEX_PATH = settings.FAISS_INDEX_PATH
ID_MAP_PATH = settings.FAISS_ID_MAP_PATH
BATCH_SIZE = 256


def build_text_for_movie(movie: Movie) -> str:
    """Combine overview + tagline + keywords into a single embedding string."""
    parts = []
    if movie.overview:
        parts.append(movie.overview)
    if movie.tagline:
        parts.append(movie.tagline)
    if movie.keywords:
        kw_list = movie.keywords if isinstance(movie.keywords, list) else []
        parts.append(". ".join(kw_list[:20]))
    if movie.genres:
        genre_names = [g["name"] for g in movie.genres if isinstance(g, dict)]
        parts.append(" ".join(genre_names))
    return " ".join(parts).strip() or movie.title


def main():
    # ── 1. Load models ─────────────────────────────────────────────────────────
    logger.info("Loading sentence-transformer: %s", settings.EMBEDDING_MODEL)
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(settings.EMBEDDING_MODEL)

    import faiss

    # ── 2. Load movies from DB ─────────────────────────────────────────────────
    engine = create_engine(settings.SYNC_DATABASE_URL, echo=False)
    Session = sessionmaker(bind=engine)
    session = Session()

    logger.info("Loading movies from database...")
    movies = session.execute(select(Movie)).scalars().all()
    logger.info("Found %d movies", len(movies))

    if not movies:
        logger.error("No movies found — run fetch_movies.py first")
        sys.exit(1)

    # ── 3. Build texts and embed ───────────────────────────────────────────────
    texts = [build_text_for_movie(m) for m in movies]
    movie_ids = [m.id for m in movies]

    logger.info("Generating embeddings in batches of %d...", BATCH_SIZE)
    all_embeddings = []
    for i in tqdm(range(0, len(texts), BATCH_SIZE), desc="Embedding batches"):
        batch = texts[i : i + BATCH_SIZE]
        vecs = model.encode(batch, convert_to_numpy=True, normalize_embeddings=True, show_progress_bar=False)
        all_embeddings.append(vecs)

    embeddings = np.vstack(all_embeddings).astype(np.float32)
    logger.info("Embeddings shape: %s", embeddings.shape)

    # ── 4. Build FAISS index ───────────────────────────────────────────────────
    dim = embeddings.shape[1]
    # IndexFlatIP with L2-normalised vectors == cosine similarity search
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    logger.info("FAISS index built: %d vectors, dim=%d", index.ntotal, dim)

    # ── 5. Save index + id_map ─────────────────────────────────────────────────
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, INDEX_PATH)
    logger.info("FAISS index saved to %s", INDEX_PATH)

    with open(ID_MAP_PATH, "w") as f:
        json.dump(movie_ids, f)
    logger.info("ID map saved to %s", ID_MAP_PATH)

    # ── 6. Update embedding_id in DB ──────────────────────────────────────────
    logger.info("Updating embedding_id in database...")
    for idx, movie in enumerate(tqdm(movies, desc="Updating DB")):
        movie.embedding_id = idx
    session.commit()
    session.close()

    logger.info("Done! FAISS index ready with %d vectors.", len(movie_ids))


if __name__ == "__main__":
    main()
