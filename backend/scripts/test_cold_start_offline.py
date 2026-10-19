#!/usr/bin/env python3
import os
import sys
import time
import tempfile
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Point temporary dirs to an empty directory
empty_tmp = tempfile.mkdtemp(prefix="empty_tmp_")
os.environ["TMPDIR"] = empty_tmp
os.environ["TEMP"] = empty_tmp
os.environ["TMP"] = empty_tmp

# Airgap HuggingFace / Transformers network access
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"

print(f"[*] Starting cold start test with empty tmp ({empty_tmp}) and NO internet...", flush=True)

t_start = time.perf_counter()

from app.main import app
from httpx import AsyncClient, ASGITransport

async def run():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        t_startup = time.perf_counter() - t_start
        print(f"[OK] App initialized in {t_startup * 1000:.1f}ms", flush=True)

        t_req_start = time.perf_counter()
        resp = await client.post(
            "/recommend",
            json={"mood_text": "dark gritty cyberpunk mystery thriller", "page": 1, "limit": 5}
        )
        t_req = time.perf_counter() - t_req_start
        print(f"[OK] Recommend endpoint returned status {resp.status_code} in {t_req * 1000:.1f}ms", flush=True)
        data = resp.json()
        recs = data.get("recommendations", [])
        titles = [r["movie"]["title"] for r in recs[:3]]
        print(f"[OK] Recommended titles: {titles}", flush=True)

if __name__ == "__main__":
    asyncio.run(run())
