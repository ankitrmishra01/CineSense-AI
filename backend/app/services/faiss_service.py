"""
FAISS service: loads the movie index at startup, embeds query text,
and returns k-nearest-neighbour movie candidates.
"""
import json
import os
import logging
from pathlib import Path
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)

# Lazy-loaded singletons — initialised on first use
_faiss_index = None
_id_map: Optional[list[int]] = None  # embedding_id → movie_id
_embed_model = None


def _get_index_paths() -> tuple[str, str]:
    from app.config import settings
    return settings.FAISS_INDEX_PATH, settings.FAISS_ID_MAP_PATH


def _ensure_loaded() -> None:
    global _faiss_index, _id_map, _embed_model
    if _faiss_index is not None:
        return

    index_path, id_map_path = _get_index_paths()

    if not Path(index_path).exists():
        raise RuntimeError(
            f"FAISS index not found at {index_path}. "
            "Run scripts/build_embeddings.py first."
        )

    try:
        import faiss
        _faiss_index = faiss.read_index(index_path)
        logger.info("FAISS index loaded: %d vectors", _faiss_index.ntotal)
    except Exception as e:
        raise RuntimeError(f"Failed to load FAISS index: {e}") from e

    with open(id_map_path, "r") as f:
        _id_map = json.load(f)

    from sentence_transformers import SentenceTransformer
    from app.config import settings
    _embed_model = SentenceTransformer(settings.EMBEDDING_MODEL)
    logger.info("Sentence-transformer model loaded: %s", settings.EMBEDDING_MODEL)


def embed_text(text: str) -> np.ndarray:
    """Embed a single query string; returns a float32 (1, dim) numpy array."""
    _ensure_loaded()
    vec = _embed_model.encode([text], convert_to_numpy=True, normalize_embeddings=True)
    return vec.astype(np.float32)


def search(query_text: str, top_k: int = 100) -> list[tuple[int, float]]:
    """
    Perform k-NN search.
    Returns list of (movie_id, similarity_score) sorted by descending similarity.
    """
    _ensure_loaded()
    import faiss

    query_vec = embed_text(query_text)
    distances, indices = _faiss_index.search(query_vec, top_k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        movie_id = _id_map[idx]
        # Inner-product on L2-normalised vectors == cosine similarity
        results.append((movie_id, float(dist)))

    return results  # already sorted descending by FAISS inner product


def preload() -> None:
    """Call at app startup to warm up the model and index."""
    try:
        _ensure_loaded()
    except RuntimeError as e:
        logger.warning("FAISS preload skipped: %s", e)
