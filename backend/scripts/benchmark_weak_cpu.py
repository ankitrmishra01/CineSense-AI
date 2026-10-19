#!/usr/bin/env python3
"""
benchmark_weak_cpu.py — Benchmarks CineSense recommendation pipeline under simulated weak CPU.
Pins process to 1 single CPU core and lowers priority using psutil.
Measures single-request latency, p50, p95, and p99 across standard mood queries.
"""
import os
import sys
import time
import statistics
import httpx
import psutil

# 1. Throttling / Resource Constraints: Pin to single core and drop priority
current_process = psutil.Process()
try:
    current_process.cpu_affinity([0])  # Pin benchmark client to Core 0
    if sys.platform == "win32":
        current_process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
    else:
        current_process.nice(10)
    print(f"[*] Benchmark client throttled: Core [0], priority: {current_process.nice()}", flush=True)
except Exception as e:
    print(f"[!] Warning on client throttling: {e}", flush=True)

# Also throttle the uvicorn server process
server_pinned = False
for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        cmdline = " ".join(proc.info['cmdline'] or [])
        if "uvicorn" in cmdline and "app.main:app" in cmdline:
            proc.cpu_affinity([0])
            if sys.platform == "win32":
                proc.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            else:
                proc.nice(10)
            print(f"[*] Uvicorn server PID {proc.pid} pinned to Core [0] with below-normal priority.", flush=True)
            server_pinned = True
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass

if not server_pinned:
    print("[!] Note: Could not find uvicorn process by cmdline to pin affinity (it may run as child or standard python).", flush=True)

BASE_URL = "http://127.0.0.1:8000"

TEST_QUERIES = [
    {"mood_text": "dark cyberpunk neon rain dystopia with synthwave music", "emotion_tags": ["🌙", "🔥"]},
    {"mood_text": "cozy heartwarming family weekend feel good comfort", "emotion_tags": ["🤗"]},
    {"mood_text": "mind-bending philosophical mystery with jaw dropping twist", "emotion_tags": ["😮", "🤔"]},
    {"mood_text": "melancholic grief and beautiful tearjerker romance", "emotion_tags": ["😢", "😍"]},
    {"mood_text": "high octane adrenaline car chase heist action thriller", "emotion_tags": ["😎", "🔥"]},
    {"mood_text": "creepy gothic haunted abandoned mansion atmospheric horror", "emotion_tags": ["👻"]},
    {"mood_text": "gentle slow-burn ambient meditation on nature and life", "emotion_tags": ["😴"]},
    {"mood_text": "hilarious witty slapstick comedy friendship road trip", "emotion_tags": ["😂"]},
    # Repeat queries to test cache impact
    {"mood_text": "dark cyberpunk neon rain dystopia with synthwave music", "emotion_tags": ["🌙", "🔥"]},
    {"mood_text": "cozy heartwarming family weekend feel good comfort", "emotion_tags": ["🤗"]},
    {"mood_text": "intense psychological thriller high stakes panic paranoia", "emotion_tags": ["😰"]},
    {"mood_text": "poignant emotional farewell across oceans", "emotion_tags": ["😢"]},
    {"mood_text": "epic historical battle swords and honor triumph", "emotion_tags": ["🔥"]},
    {"mood_text": "philosophical meditation, intellectual depth", "emotion_tags": ["🤔"]},
    {"mood_text": "sweet romantic comedy under starry skies", "emotion_tags": ["😍", "😂"]},
]

def run_benchmark(num_runs: int = 15):
    print(f"[*] Starting Weak CPU Benchmark against {BASE_URL} ({num_runs} requests)...", flush=True)
    latencies = []
    status_codes = {}
    
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        # Check health first
        h = client.get("/health")
        print(f"[*] Server health check: {h.status_code} - {h.json()}")
        
        for i in range(num_runs):
            payload = TEST_QUERIES[i % len(TEST_QUERIES)]
            t0 = time.perf_counter()
            try:
                res = client.post("/recommend", json=payload)
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                latencies.append(elapsed_ms)
                status_codes[res.status_code] = status_codes.get(res.status_code, 0) + 1
                if i < 3 or i == num_runs - 1:
                    print(f"  Req {i+1:02d}: {res.status_code} in {elapsed_ms:.1f}ms | Query: {payload['mood_text'][:35]}...")
            except Exception as e:
                elapsed_ms = (time.perf_counter() - t0) * 1000.0
                print(f"  Req {i+1:02d} FAILED in {elapsed_ms:.1f}ms: {e}")
                status_codes["ERR"] = status_codes.get("ERR", 0) + 1
    
    if not latencies:
        print("[!] No successful responses.")
        return None

    latencies.sort()
    n = len(latencies)
    p50 = statistics.median(latencies)
    p90 = latencies[int(n * 0.90)] if n > 1 else latencies[0]
    p95 = latencies[int(n * 0.95)] if n > 1 else latencies[0]
    p99 = latencies[int(n * 0.99)] if n > 1 else latencies[0]
    mean_lat = statistics.mean(latencies)
    min_lat = min(latencies)
    max_lat = max(latencies)

    print("\n" + "=" * 50)
    print("WEAK CPU BENCHMARK RESULTS (1 Core Pinned)")
    print("=" * 50)
    print(f"Total Requests : {n}")
    print(f"Status Codes   : {status_codes}")
    print(f"Min Latency    : {min_lat:.1f} ms")
    print(f"Mean Latency   : {mean_lat:.1f} ms")
    print(f"p50 (Median)   : {p50:.1f} ms")
    print(f"p90            : {p90:.1f} ms")
    print(f"p95            : {p95:.1f} ms")
    print(f"p99            : {p99:.1f} ms")
    print(f"Max Latency    : {max_lat:.1f} ms")
    print("=" * 50)
    return {
        "p50": p50,
        "p95": p95,
        "p99": p99,
        "mean": mean_lat,
        "min": min_lat,
        "max": max_lat,
    }

if __name__ == "__main__":
    run_benchmark(num_runs=15)
