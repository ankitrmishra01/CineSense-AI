import os
import sys
import time
import tracemalloc
import psutil

sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

process = psutil.Process(os.getpid())

def get_rss_mb():
    return process.memory_info().rss / (1024 * 1024)

print("=" * 70, flush=True)
print("🚀 CineSense AI — Production ONNX (FastEmbed) Memory Profiling", flush=True)
print("=" * 70, flush=True)

tracemalloc.start()

# Stage 0: Clean Process
m0 = get_rss_mb()
print(f"Stage 0: Bare Python Process RSS:               {m0:6.1f} MB", flush=True)

# Stage 1: Basic App Imports (FastAPI, Pydantic, SQLAlchemy)
import fastapi
import sqlalchemy
import pydantic
m1 = get_rss_mb()
print(f"Stage 1: After Web Frameworks (FastAPI/SQLA):   {m1:6.1f} MB  (+{m1 - m0:5.1f} MB)", flush=True)

# Stage 2: Production Libraries Import (FAISS, fastembed, onnxruntime)
import faiss
m_faiss = get_rss_mb()
print(f"Stage 2a: After Importing FAISS:                {m_faiss:6.1f} MB  (+{m_faiss - m1:5.1f} MB)", flush=True)

from fastembed import TextEmbedding
m_fe = get_rss_mb()
print(f"Stage 2b: After Importing FastEmbed / ONNX:     {m_fe:6.1f} MB  (+{m_fe - m_faiss:5.1f} MB)", flush=True)

# Stage 3: Load Model & Index via faiss_service
from app.services.faiss_service import _ensure_loaded, search, embed_text
_ensure_loaded()
m3 = get_rss_mb()
print(f"Stage 3: After Model & FAISS Index Loaded:      {m3:6.1f} MB  (+{m3 - m_fe:5.1f} MB)", flush=True)

# Stage 4: First Mood Search Request
query = "cozy rainy comfort movie with heartwarming feelings"
t0 = time.time()
res_first = search(query, top_k=20)
t_first = (time.time() - t0) * 1000
m4 = get_rss_mb()
print(f"Stage 4: After First Request ({t_first:.1f}ms):         {m4:6.1f} MB  (+{m4 - m3:5.1f} MB)", flush=True)

# Stage 5: 100 Sequential Searches
t_start = time.time()
for i in range(100):
    search(f"query {i} {query}", top_k=20)
t_seq = time.time() - t_start
m5 = get_rss_mb()
print(f"Stage 5: After 100 Sequential Searches ({t_seq:.2f}s): {m5:6.1f} MB  (+{m5 - m4:5.1f} MB)", flush=True)

# Stage 6: 20 Concurrent Searches
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(max_workers=20) as executor:
    list(executor.map(lambda i: search(f"concurrent {i} {query}", top_k=20), range(20)))
m6 = get_rss_mb()
print(f"Stage 6: After 20 Concurrent Searches:          {m6:6.1f} MB  (+{m6 - m5:5.1f} MB)", flush=True)

# Stage 7: Memory Soak Test (500 requests for leak check)
m_soak_start = get_rss_mb()
for i in range(500):
    search(f"soak test query {i % 25}", top_k=20)
m7 = get_rss_mb()
print(f"Stage 7: After 500 Soak Requests:               {m7:6.1f} MB  (delta: {m7 - m_soak_start:+.1f} MB)", flush=True)

# Tracemalloc Top Allocations
current, peak = tracemalloc.get_traced_memory()
tracemalloc.stop()
print("-" * 70, flush=True)
print(f"Tracemalloc Peak Memory: {peak / (1024 * 1024):.1f} MB", flush=True)
print(f"FINAL RUNTIME RSS: {m7:.1f} MB (Limit is 512 MB, Headroom: {512 - m7:.1f} MB)", flush=True)
print("=" * 70, flush=True)
