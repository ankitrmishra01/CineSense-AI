#!/usr/bin/env python3
"""
download_model.py — Pre-download ONNX embedding model at BUILD time into a local project cache.
Ensures zero network downloads during cold start in production.
"""
import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = (BACKEND_DIR / ".cache" / "fastembed").resolve()
CACHE_DIR.mkdir(parents=True, exist_ok=True)

print(f"[*] Pre-downloading fastembed model into: {CACHE_DIR} ...", flush=True)

from fastembed import TextEmbedding

model = TextEmbedding(
    model_name="sentence-transformers/all-MiniLM-L6-v2",
    cache_dir=str(CACHE_DIR),
)

# Run a sample inference to ensure ONNX model graph is loaded and verified
sample_vec = list(model.embed(["CineSense AI offline model initialization verification"]))
print(f"[OK] Model successfully downloaded and verified. Vector dim: {len(sample_vec[0])}", flush=True)
