import os
import sys
import time
import asyncio
from collections import Counter
import psutil
import httpx
import numpy as np

sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000")
import argparse
parser = argparse.ArgumentParser(description="CineSense load test")
parser.add_argument("--concurrency", "-c", type=int, default=20, help="Concurrent workers")
parser.add_argument("--requests", "-n", type=int, default=1000, help="Total requests")
args, _ = parser.parse_known_args()

CONCURRENCY = args.concurrency
TOTAL_REQUESTS = args.requests

print("=" * 75, flush=True)
print(f"⚡ CineSense AI Load Test ({CONCURRENCY} concurrent users, {TOTAL_REQUESTS} total requests)", flush=True)
print(f"Target: {BASE_URL}", flush=True)
print("=" * 75, flush=True)

# 1. Discover the real server process and entire process tree
def find_backend_process_tree():
    root_proc = None
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmd = proc.info.get('cmdline') or []
            cmd_str = " ".join(cmd)
            # Find the uvicorn master process
            if "uvicorn" in cmd_str and ("app.main:app" in cmd_str or "app.main" in cmd_str):
                # Prefer the parent launcher or the direct worker
                root_proc = proc
                break
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass

    if not root_proc:
        return []

    # Collect root and all recursive children
    tree = [root_proc]
    try:
        children = root_proc.children(recursive=True)
        tree.extend(children)
    except Exception:
        pass

    # Deduplicate by PID
    by_pid = {p.pid: p for p in tree}
    return list(by_pid.values())

target_procs = find_backend_process_tree()

if target_procs:
    print("[*] Measured Server Process Tree:", flush=True)
    for p in target_procs:
        try:
            rss_mb = p.memory_info().rss / (1024 * 1024)
            cmd_summary = " ".join(p.cmdline()[:5])
            print(f"  • [PID {p.pid}] {p.name()} | RSS: {rss_mb:.2f} MB | Cmd: {cmd_summary}", flush=True)
        except Exception as e:
            print(f"  • [PID {p.pid}] {p.name()} (error reading info: {e})", flush=True)
else:
    print("[!] Warning: Uvicorn process not detected via psutil. Falling back to client process measurement.", flush=True)

def get_backend_rss() -> float:
    if not target_procs:
        return psutil.Process().memory_info().rss / (1024 * 1024)

    total_rss = 0.0
    for p in target_procs:
        try:
            total_rss += p.memory_info().rss / (1024 * 1024)
            # Also catch any dynamically spawned children
            for child in p.children(recursive=True):
                if child.pid not in [tp.pid for tp in target_procs]:
                    total_rss += child.memory_info().rss / (1024 * 1024)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return total_rss

TEST_PAYLOADS = [
    {"url": "/health", "method": "GET", "json": None},
    {"url": "/health/detailed", "method": "GET", "json": None},
    {"url": "/movies/live/trending", "method": "GET", "json": None},
    {"url": "/movies/live/trending-india", "method": "GET", "json": None},
    {"url": "/movies/live/trending-by-language?lang=hi", "method": "GET", "json": None},
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "heartfelt cozy comforting movie for a rainy evening", "preferred_languages": ["hi", "en"], "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"emotion_tags": ["😢", "🤗"], "preferred_languages": ["ta", "te"], "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "best mollywood mystery thriller", "preferred_languages": ["ml", "en"], "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "हॉरर कॉमेडी फिल्में", "preferred_languages": ["hi", "en"], "page": 1, "limit": 10}
    },
    {
        "url": "/recommend",
        "method": "POST",
        "json": {"mood_text": "epic historical battle with swords and honor", "preferred_languages": ["te", "en"], "page": 1, "limit": 10}
    },
]

async def worker(queue: asyncio.Queue, results: list, errors: list, mem_samples: list, sem: asyncio.Semaphore, client: httpx.AsyncClient):
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
                if resp.status_code not in (200, 201):
                    errors.append((resp.status_code, resp.text[:150]))
            except Exception as e:
                dur = (time.perf_counter() - t0) * 1000
                results.append((500, dur))
                errors.append((500, str(e)))

        if req_idx % 100 == 0 or queue.empty():
            mem = get_backend_rss()
            mem_samples.append((req_idx, mem))
            print(f"  • Progress: {req_idx:4d}/{TOTAL_REQUESTS} requests | Recent Latency: {dur:5.1f}ms | Process Tree RSS: {mem:6.1f} MB", flush=True)

        queue.task_done()

async def main():
    queue = asyncio.Queue()
    for i in range(TOTAL_REQUESTS):
        payload = TEST_PAYLOADS[i % len(TEST_PAYLOADS)]
        queue.put_nowait((i + 1, payload))

    results = []
    errors = []
    mem_samples = []
    sem = asyncio.Semaphore(CONCURRENCY)

    initial_mem = get_backend_rss()
    print(f"\n[*] Baseline Process Tree RSS before load test: {initial_mem:.2f} MB", flush=True)

    t_start = time.perf_counter()
    limits = httpx.Limits(max_keepalive_connections=CONCURRENCY, max_connections=CONCURRENCY * 2)
    async with httpx.AsyncClient(limits=limits, timeout=12.0) as client:
        tasks = [
            asyncio.create_task(worker(queue, results, errors, mem_samples, sem, client))
            for _ in range(CONCURRENCY)
        ]
        await asyncio.gather(*tasks)

    t_total = time.perf_counter() - t_start
    final_mem = get_backend_rss()

    latencies = [d for _, d in results]
    status_counts = Counter(status for status, _ in results)
    success_count = sum(cnt for st, cnt in status_counts.items() if st in (200, 201))
    error_count = TOTAL_REQUESTS - success_count

    print("\n" + "=" * 75, flush=True)
    print("📊 LOAD TEST EXECUTION RESULTS (1,000 REQUESTS / 20 CONCURRENCY):", flush=True)
    print(f"  • Total Completed Requests:  {TOTAL_REQUESTS}")
    print(f"  • Concurrent Users:          {CONCURRENCY}")
    print(f"  • Total Duration:            {t_total:.2f}s")
    print(f"  • Throughput:                {TOTAL_REQUESTS / t_total:.1f} req/s")
    print(f"  • Successful Requests (200): {success_count} ({success_count/TOTAL_REQUESTS*100:.2f}%)")
    print(f"  • Throttled Requests (503):  {status_counts.get(503, 0)} ({status_counts.get(503, 0)/TOTAL_REQUESTS*100:.2f}%)")
    print(f"  • Status Code Breakdown:     {dict(status_counts)}")
    if errors:
        print(f"  • Error Samples:             {errors[:5]}")
    print(f"  • Latency Min:               {np.min(latencies):.1f} ms")
    print(f"  • Latency Median (p50):      {np.median(latencies):.1f} ms")
    print(f"  • Latency p95:               {np.percentile(latencies, 95):.1f} ms")
    print(f"  • Latency p99:               {np.percentile(latencies, 99):.1f} ms")
    print("-" * 75, flush=True)
    print("🧠 PROCESS TREE RSS MEMORY (Render 512 MB Limit Target):", flush=True)
    peak_mem = max(m for _, m in mem_samples) if mem_samples else final_mem
    peak_mem = max(peak_mem, initial_mem, final_mem)
    print(f"  • Baseline RSS:              {initial_mem:.2f} MB")
    print(f"  • Peak RSS during soak:      {peak_mem:.2f} MB")
    print(f"  • Final RSS after soak:      {final_mem:.2f} MB")
    print(f"  • Memory Drift:              {final_mem - initial_mem:+.2f} MB")
    print(f"  • Free Headroom in 512 MB:   {512 - peak_mem:.2f} MB ({((512 - peak_mem)/512)*100:.1f}% free)")
    print("=" * 75, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
