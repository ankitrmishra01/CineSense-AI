import os
import sys
import time
import asyncio
import psutil
import httpx
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
CONCURRENCY = 20
TOTAL_REQUESTS = 1000

print("=" * 70, flush=True)
print(f"⚡ CineSense AI — 1,000 Requests Load Test ({CONCURRENCY} concurrent users)", flush=True)
print(f"Target: {BASE_URL}", flush=True)
print("=" * 70, flush=True)

# Find backend process if running locally
backend_proc = None
for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cmdline = " ".join(proc.info['cmdline'] or [])
        if "uvicorn" in cmdline and "app.main:app" in cmdline:
            backend_proc = proc
            break
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

def get_backend_rss():
    if backend_proc:
        try:
            return backend_proc.memory_info().rss / (1024 * 1024)
        except Exception:
            return 0.0
    return psutil.Process().memory_info().rss / (1024 * 1024)

TEST_PAYLOADS = [
    {"url": "/health", "method": "GET", "json": None},
    {"url": "/health/detailed", "method": "GET", "json": None},
    {"url": "/movies/popular?page=1&limit=10", "method": "GET", "json": None},
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "heartfelt cozy comforting movie for a rainy evening", "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"emotion_tags": ["😢", "🤗"], "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "dark gritty cyberpunk mystery thriller", "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "hilarious lighthearted comedy with great banter", "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "epic historical battle with swords and honor", "page": 1, "limit": 10}
    },
]

async def worker(queue: asyncio.Queue, results: list, mem_samples: list, sem: asyncio.Semaphore, client: httpx.AsyncClient):
    while not queue.empty():
        req_idx, payload = await queue.get()
        t0 = time.perf_counter()
        async with sem:
            try:
                if payload["method"] == "GET":
                    resp = await client.get(f"{BASE_URL}{payload['url']}", timeout=10.0)
                else:
                    resp = await client.post(f"{BASE_URL}{payload['url']}", json=payload["json"], timeout=10.0)
                dur = (time.perf_counter() - t0) * 1000
                results.append((resp.status_code, dur))
            except Exception as e:
                dur = (time.perf_counter() - t0) * 1000
                results.append((500, dur))

        if req_idx % 100 == 0 or queue.empty():
            mem = get_backend_rss()
            mem_samples.append((req_idx, mem))
            print(f"  • Progress: {req_idx:4d}/{TOTAL_REQUESTS} requests | Latency: {dur:5.1f}ms | Backend RSS: {mem:6.1f} MB", flush=True)

        queue.task_done()

async def main():
    queue = asyncio.Queue()
    for i in range(TOTAL_REQUESTS):
        payload = TEST_PAYLOADS[i % len(TEST_PAYLOADS)]
        queue.put_nowait((i + 1, payload))

    results = []
    mem_samples = []
    sem = asyncio.Semaphore(CONCURRENCY)

    initial_mem = get_backend_rss()
    print(f"Initial Backend RSS before load test: {initial_mem:.1f} MB", flush=True)

    t_start = time.perf_counter()
    limits = httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY * 2)
    async with httpx.AsyncClient(limits=limits) as client:
        tasks = [
            asyncio.create_task(worker(queue, results, mem_samples, sem, client))
            for _ in range(CONCURRENCY)
        ]
        await asyncio.gather(*tasks)

    t_total = time.perf_counter() - t_start
    final_mem = get_backend_rss()

    latencies = [d for _, d in results]
    success_count = sum(1 for status, _ in results if status in (200, 201))
    error_count = TOTAL_REQUESTS - success_count

    print("-" * 70, flush=True)
    print("📊 LOAD TEST EXECUTION RESULTS:", flush=True)
    print(f"  • Total Completed Requests:  {TOTAL_REQUESTS}")
    print(f"  • Concurrent Users:          {CONCURRENCY}")
    print(f"  • Total Duration:            {t_total:.2f}s")
    print(f"  • Throughput:                {TOTAL_REQUESTS / t_total:.1f} req/s")
    print(f"  • Successful Requests:       {success_count} ({success_count/TOTAL_REQUESTS*100:.1f}%)")
    print(f"  • Error Count:               {error_count} ({error_count/TOTAL_REQUESTS*100:.1f}%)")
    print(f"  • Latency Min:               {np.min(latencies):.1f} ms")
    print(f"  • Latency Median (p50):      {np.median(latencies):.1f} ms")
    print(f"  • Latency p95:               {np.percentile(latencies, 95):.1f} ms")
    print(f"  • Latency p99:               {np.percentile(latencies, 99):.1f} ms")
    print("-" * 70, flush=True)
    print("🧠 MEMORY METRICS & HEADROOM (Render 512 MB Limit):", flush=True)
    peak_mem = max(m for _, m in mem_samples) if mem_samples else final_mem
    print(f"  • Baseline RSS:              {initial_mem:.1f} MB")
    print(f"  • Peak RSS during 1,000 req: {peak_mem:.1f} MB")
    print(f"  • Final RSS after soak:      {final_mem:.1f} MB")
    print(f"  • Memory Growth (Leak):      {final_mem - initial_mem:+.1f} MB")
    print(f"  • Free Headroom in 512 MB:   {512 - peak_mem:.1f} MB ({((512 - peak_mem)/512)*100:.1f}% free)")
    print("=" * 70, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
