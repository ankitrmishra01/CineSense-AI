import pytest
import numpy as np
from app.services.faiss_service import embed_text, search, get_faiss_stats, is_loaded, preload

def test_fastembed_onnx_runtime_active():
    preload()
    stats = get_faiss_stats()
    assert stats["runtime"] == "onnx-fastembed"
    assert is_loaded() is True
    assert stats["loaded"] is True

def test_embed_text_returns_l2_normalized_float32():
    vec = embed_text("A cozy movie on a rainy day")
    assert isinstance(vec, np.ndarray)
    assert vec.dtype == np.float32
    assert vec.shape[0] == 1
    assert vec.shape[1] == 384
    # L2 norm should be ~1.0
    norm = np.linalg.norm(vec[0])
    assert abs(norm - 1.0) < 1e-4

def test_faiss_search_returns_valid_tuples():
    results = search("heartfelt drama with quiet moments", top_k=5)
    assert len(results) > 0
    assert len(results) <= 5
    for movie_id, score in results:
        assert isinstance(movie_id, int)
        assert isinstance(score, float)
        assert -1.0 <= score <= 1.05
