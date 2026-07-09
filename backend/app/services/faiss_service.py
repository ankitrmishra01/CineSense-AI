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
import httpx
from fastapi import HTTPException

logger = logging.getLogger(__name__)

# Lazy-loaded singletons — initialised on first use
_faiss_index = None
_id_map: Optional[list[int]] = None  # embedding_id → movie_id


def _get_index_paths() -> tuple[str, str]:
    from app.config import settings
    return settings.FAISS_INDEX_PATH, settings.FAISS_ID_MAP_PATH


def _ensure_loaded() -> None:
    global _faiss_index, _id_map
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


def embed_text(text: str) -> np.ndarray:
    """Embed a single query string using Hugging Face API; returns a float32 (1, dim) numpy array."""
    from app.config import settings
    _ensure_loaded()
    
    url = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{settings.EMBEDDING_MODEL}"
    headers = {"Authorization": f"Bearer {settings.HF_API_KEY}"}
    
    try:
        # Use sync httpx request because faiss_service.search is called synchronously in the router.
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, headers=headers, json={"inputs": [text]})
            response.raise_for_status()
            
            raw_data = response.json()
            
            # The feature-extraction pipeline can return nested arrays
            vec = np.array(raw_data, dtype=np.float32)
            
            # If shape is [1, seq_len, 384] or [seq_len, 384], mean pool across sequence dimension
            if vec.ndim == 3:  # [batch, seq_len, dim]
                vec = np.mean(vec[0], axis=0, keepdims=True)
            elif vec.ndim == 2 and vec.shape[0] > 1:  # [seq_len, dim]
                vec = np.mean(vec, axis=0, keepdims=True)
            elif vec.ndim == 1:  # [dim]
                vec = np.expand_dims(vec, axis=0)
            elif vec.ndim == 2 and vec.shape[0] == 1: # [1, dim]
                pass
                
            # L2 Normalize for FAISS inner product (cosine similarity)
            norms = np.linalg.norm(vec, axis=1, keepdims=True)
            norms = np.where(norms == 0, 1e-10, norms)
            vec = vec / norms
            
            return vec
            
    except Exception as e:
        logger.error(f"Failed to get embeddings from Hugging Face: {e}")
        # If HF is down or sleeping and times out, we raise a 503 so the frontend knows
        raise RuntimeError(f"Embedding API error: {str(e)}. If this persists, the HF model may be sleeping.")


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
    """Call at app startup to warm up the index."""
    try:
        _ensure_loaded()
    except RuntimeError as e:
        logger.warning("FAISS preload skipped: %s", e)
