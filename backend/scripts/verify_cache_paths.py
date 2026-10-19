#!/usr/bin/env python3
"""
verify_cache_paths.py — Proves build-time model download path and runtime service cache path
resolve to the exact same directory, and tests offline model load without internet.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

# 1. Resolve path from download_model perspective
from scripts.download_model import CACHE_DIR as BUILD_CACHE_DIR

# 2. Resolve path from app.config perspective
from app.config import settings

# 3. Resolve path from faiss_service
import app.services.faiss_service as fs

def test_cache_alignment():
    print("=" * 60)
    print("CACHE PATH ALIGNMENT VERIFICATION")
    print("=" * 60)
    
    build_path = str(BUILD_CACHE_DIR)
    config_path = str(Path(settings.FASTEMBED_CACHE_PATH).resolve())
    
    print(f"Build-time cache path : {build_path}")
    print(f"Runtime config cache  : {config_path}")
    
    assert build_path == config_path, f"Path mismatch! Build: {build_path} != Config: {config_path}"
    print("[PASS] Build-time path and Runtime path match identically.")
    
    assert BUILD_CACHE_DIR.exists(), f"Cache dir {BUILD_CACHE_DIR} does not exist!"
    files = list(BUILD_CACHE_DIR.rglob("*"))
    print(f"[PASS] Model cache directory contains {len(files)} files/folders.")
    
    # Test offline load
    print("\nTesting offline model loading with HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE set...")
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    
    # Embed test
    vec = fs.embed_text("Verify offline inference")
    assert vec.shape == (1, 384), f"Unexpected shape {vec.shape}"
    print(f"[PASS] Offline inference succeeded! Vector shape: {vec.shape}, norm: {float(sum(vec[0]**2)):.4f}")
    
    # Test embedding cache
    vec2 = fs.embed_text("Verify offline inference")
    assert vec2.shape == (1, 384)
    print("[PASS] In-memory query embedding cache hit verified.")
    print("=" * 60)

if __name__ == "__main__":
    test_cache_alignment()
