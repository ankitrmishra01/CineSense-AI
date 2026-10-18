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

import threading

logger = logging.getLogger(__name__)

# Lazy-loaded singletons — initialised on first use
_faiss_index = None
_id_map: Optional[list[int]] = None  # embedding_id → movie_id
_embed_model = None
_load_lock = threading.Lock()


def _get_index_paths() -> tuple[str, str]:
    from app.config import settings
    from pathlib import Path

    idx = Path(settings.FAISS_INDEX_PATH)
    idm = Path(settings.FAISS_ID_MAP_PATH)
    if not idx.exists():
        backend_idx = Path(__file__).resolve().parent.parent.parent / settings.FAISS_INDEX_PATH
        if backend_idx.exists():
            idx = backend_idx
    if not idm.exists():
        backend_idm = Path(__file__).resolve().parent.parent.parent / settings.FAISS_ID_MAP_PATH
        if backend_idm.exists():
            idm = backend_idm
    return str(idx), str(idm)


def _ensure_loaded() -> None:
    global _faiss_index, _id_map, _embed_model
    if _faiss_index is not None and _embed_model is not None:
        return

    with _load_lock:
        if _faiss_index is not None and _embed_model is not None:
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

        with open(id_map_path, "r", encoding="utf-8") as f:
            _id_map = json.load(f)

        # Use fastembed (ONNX runtime) for lightweight, low-memory inference
        # 100% cosine similarity match with reference all-MiniLM-L6-v2 index
        from fastembed import TextEmbedding
        from app.config import settings
        raw_name = getattr(settings, 'EMBEDDING_MODEL', 'sentence-transformers/all-MiniLM-L6-v2') or 'sentence-transformers/all-MiniLM-L6-v2'
        model_name = f"sentence-transformers/{raw_name}" if "/" not in raw_name else raw_name
        cache_dir = getattr(settings, 'FASTEMBED_CACHE_PATH', None) or os.getenv('FASTEMBED_CACHE_PATH')
        _embed_model = TextEmbedding(model_name=model_name, cache_dir=cache_dir)
        logger.info("FastEmbed ONNX model loaded: %s (cache: %s)", model_name, cache_dir or "default")


def is_loaded() -> bool:
    """Check if both FAISS index and embedding model are loaded."""
    return _faiss_index is not None and _embed_model is not None and _id_map is not None


def embed_text(text: str) -> np.ndarray:
    """Embed a single query string; returns a float32 (1, dim) L2-normalized numpy array."""
    _ensure_loaded()
    vecs = np.array(list(_embed_model.embed([text])), dtype=np.float32)
    norm = np.linalg.norm(vecs, axis=1, keepdims=True)
    vecs = vecs / np.maximum(norm, 1e-12)
    return vecs.astype(np.float32)


def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed multiple strings; returns a float32 (N, dim) L2-normalized numpy array."""
    _ensure_loaded()
    vecs = np.array(list(_embed_model.embed(texts)), dtype=np.float32)
    norm = np.linalg.norm(vecs, axis=1, keepdims=True)
    vecs = vecs / np.maximum(norm, 1e-12)
    return vecs.astype(np.float32)


def search(query_text: str, top_k: int = 100) -> list[tuple[int, float]]:
    """
    Perform k-NN search.
    Returns list of (movie_id, similarity_score) sorted by descending similarity.
    """
    _ensure_loaded()

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


def search_by_vector(query_vec: np.ndarray, top_k: int = 100) -> list[tuple[int, float]]:
    """Perform k-NN search directly with a vector."""
    _ensure_loaded()
    distances, indices = _faiss_index.search(query_vec, top_k)
    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx == -1:
            continue
        movie_id = _id_map[idx]
        results.append((movie_id, float(dist)))
    return results


def get_movie_vector(embedding_id: int) -> Optional[np.ndarray]:
    """Retrieve the original vector for a given embedding_id from FAISS."""
    _ensure_loaded()
    try:
        vec = _faiss_index.reconstruct(embedding_id)
        # Ensure it's shaped as (1, dim) for the search function
        return np.array([vec], dtype=np.float32)
    except Exception as e:
        logger.error(f"Failed to reconstruct vector for embedding_id {embedding_id}: {e}")
        return None


def preload() -> None:
    """Call at app startup to warm up the model and index."""
    try:
        _ensure_loaded()
    except RuntimeError as e:
        logger.warning("FAISS preload skipped: %s", e)


def get_faiss_stats() -> dict:
    """Return status dictionary of the FAISS index."""
    global _faiss_index
    if _faiss_index is not None:
        return {"loaded": True, "vectors": int(_faiss_index.ntotal), "runtime": "onnx-fastembed"}
    index_path, _ = _get_index_paths()
    return {"loaded": False, "exists_on_disk": Path(index_path).exists(), "runtime": "onnx-fastembed"}


