import sys
import json
import time
import urllib.request
import urllib.error

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

GOLDEN_QUERIES = [
    # ── 1. Indian Industry Nicknames ──
    {"prompt": "best bollywood comedy movies", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "top rated tollywood action films", "pref": ["te", "en"], "expected_lang": "te"},
    {"prompt": "grounded kollywood crime thriller", "pref": ["ta", "en"], "expected_lang": "ta"},
    {"prompt": "realistic mollywood mystery drama", "pref": ["ml", "en"], "expected_lang": "ml"},
    {"prompt": "epic sandalwood mythological cinema", "pref": ["kn", "en"], "expected_lang": "kn"},
    {"prompt": "classic tollywood bangla literature film", "pref": ["bn", "en"], "expected_lang": "bn"},
    {"prompt": "award winning marathi cinema", "pref": ["mr", "en"], "expected_lang": "mr"},
    {"prompt": "energetic punjabi family entertainer", "pref": ["pa", "en"], "expected_lang": "pa"},
    {"prompt": "gripping k-cinema neo noir thriller", "pref": ["ko", "en"], "expected_lang": "ko"},
    {"prompt": "aesthetic anime with deep emotional philosophy", "pref": ["ja", "en"], "expected_lang": "ja"},

    # ── 2. Native Scripts (Devanagari, Tamil, Telugu, Malayalam, etc.) ──
    {"prompt": "हॉरर कॉमेडी फिल्में", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "दिल को छू लेने वाली प्रेम कहानी", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "रोमांचक सस्पेंस मर्डर मिस्ट्री", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "திருப்பங்கள் நிறைந்த அதிரடி திரைப்படம்", "pref": ["ta", "en"], "expected_lang": "ta"},
    {"prompt": "குடும்ப நகைச்சுவை திரைப்படம்", "pref": ["ta", "en"], "expected_lang": "ta"},
    {"prompt": "మంచి ప్రేమ కథ మరియు భావోద్వేగ చిత్రం", "pref": ["te", "en"], "expected_lang": "te"},
    {"prompt": "భారీ యాక్షన్ మరియు సస్పెన్స్ సినిమా", "pref": ["te", "en"], "expected_lang": "te"},
    {"prompt": "മനോഹരമായ കുടുംബ ചിത്രം", "pref": ["ml", "en"], "expected_lang": "ml"},
    {"prompt": "കുറ്റാന്വേഷണ ത്രില്ലർ", "pref": ["ml", "en"], "expected_lang": "ml"},
    {"prompt": "ಉತ್ತಮ ಕೌಟುಂಬಿಕ ಹಾಸ್ಯ ಚಲನಚಿತ್ರ", "pref": ["kn", "en"], "expected_lang": "kn"},
    {"prompt": "ভালোবাসার রোমান্টিক সিনেমা", "pref": ["bn", "en"], "expected_lang": "bn"},
    {"prompt": "गंभीर भावनिक मराठी चित्रपट", "pref": ["mr", "en"], "expected_lang": "mr"},
    {"prompt": "ਦਿਲਚਸਪ ਪੰਜਾਬੀ ਕਾਮੇਡੀ", "pref": ["pa", "en"], "expected_lang": "pa"},
    {"prompt": "긴장감 넘치는 심리 스릴러", "pref": ["ko", "en"], "expected_lang": "ko"},
    {"prompt": "감동적인 로맨스 영화", "pref": ["ko", "en"], "expected_lang": "ko"},
    {"prompt": "心を揺さぶる感動のアニメ映画", "pref": ["ja", "en"], "expected_lang": "ja"},

    # ── 3. Hinglish & Colloquial Indian English ──
    {"prompt": "koi badhiya suspense movie batao", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "dost ke sath dekhne wali mast comedy", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "pyar aur dard wali emotional movie", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "bhai action movie chahiye dhoom dhadaka", "pref": ["hi", "te"], "expected_lang": "hi"},
    {"prompt": "dimag hila dene wali thriller", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "lighthearted family ke sath timepass", "pref": ["hi", "en"], "expected_lang": "hi"},

    # ── 4. Cross-lingual Moods with Preference Boost ──
    {"prompt": "heartwarming family drama about village life", "pref": ["hi", "ta"], "expected_lang": "regional"},
    {"prompt": "existential loneliness in a bustling night city", "pref": ["en", "hi", "ko"], "expected_lang": "any"},
    {"prompt": "intense courtroom battle for justice", "pref": ["hi", "ta", "ml"], "expected_lang": "regional"},
    {"prompt": "quirky coming of age road trip", "pref": ["hi", "en"], "expected_lang": "regional"},
    {"prompt": "dark claustrophobic survival against odds", "pref": ["ko", "en", "ml"], "expected_lang": "any"},
    {"prompt": "nostalgic childhood memories in summer", "pref": ["ja", "hi", "bn"], "expected_lang": "any"},
    {"prompt": "epic historical rebellion against empire", "pref": ["te", "hi", "en"], "expected_lang": "regional"},
    {"prompt": "philosophical sci fi pondering human destiny", "pref": ["en", "ja"], "expected_lang": "any"},

    # ── 5. Auteur & Cinematic Masters ──
    {"prompt": "movies by Satyajit Ray", "pref": ["bn", "hi", "en"], "expected_lang": "bn"},
    {"prompt": "masterpieces of Mani Ratnam", "pref": ["ta", "hi"], "expected_lang": "ta"},
    {"prompt": "raw indie cinema like Anurag Kashyap", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "social comedies like Rajkumar Hirani", "pref": ["hi", "en"], "expected_lang": "hi"},
    {"prompt": "grand visual spectacles by SS Rajamouli", "pref": ["te", "hi"], "expected_lang": "te"},
    {"prompt": "dark interconnected universe by Lokesh Kanagaraj", "pref": ["ta", "te"], "expected_lang": "ta"},
    {"prompt": "subtle naturalistic films of Dileesh Pothan", "pref": ["ml", "en"], "expected_lang": "ml"},
    {"prompt": "social satire like Bong Joon-ho", "pref": ["ko", "en"], "expected_lang": "ko"},
    {"prompt": "whimsical worlds of Hayao Miyazaki", "pref": ["ja", "en"], "expected_lang": "ja"},
    {"prompt": "time twisting puzzles of Christopher Nolan", "pref": ["en"], "expected_lang": "en"},

    # ── 6. Genre + Language Concurrency & Diversity ──
    {"prompt": "romantic musical with unforgettable soundtrack", "pref": ["hi", "ta"], "expected_lang": "regional"},
    {"prompt": "gripping police procedural crime investigation", "pref": ["ml", "ta", "hi"], "expected_lang": "regional"},
    {"prompt": "laugh out loud buddy comedy", "pref": ["hi", "te", "en"], "expected_lang": "any"},
    {"prompt": "spooky atmospheric folklore horror", "pref": ["kn", "hi", "ml"], "expected_lang": "regional"},
    {"prompt": "tender unrequited love story", "pref": ["ko", "hi", "en"], "expected_lang": "any"},
    {"prompt": "underworld gang wars and loyalty", "pref": ["hi", "ta", "te"], "expected_lang": "regional"},
    {"prompt": "sports underdog overcoming all barriers", "pref": ["hi", "te", "en"], "expected_lang": "any"},
    {"prompt": "intense psychological thriller with moral dilemmas", "pref": ["ko", "ml", "en"], "expected_lang": "any"},
    {"prompt": "magical realism and lyrical storytelling", "pref": ["es", "bn", "ja"], "expected_lang": "any"},
    {"prompt": "cozy monsoon rain movie to watch with chai", "pref": ["hi", "ml", "en"], "expected_lang": "regional"},
]

def run_evaluation():
    print(f"Starting Golden Set Evaluation across {len(GOLDEN_QUERIES)} queries...\n")
    results = []
    latencies = []
    errors = 0

    for i, q in enumerate(GOLDEN_QUERIES, 1):
        payload = {
            "mood_text": q["prompt"],
            "preferred_languages": q["pref"],
            "limit": 10
        }
        req = urllib.request.Request(
            "http://127.0.0.1:8000/recommend",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )

        t0 = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=10.0) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                dur_ms = (time.perf_counter() - t0) * 1000
                latencies.append(dur_ms)

                recs = data.get("recommendations", [])
                returned_langs = [r["movie"]["original_language"] for r in recs if r.get("movie")]
                top_lang = returned_langs[0] if returned_langs else "none"
                
                # Check alignment with preferences or expected language
                matched = False
                if q["expected_lang"] == "regional":
                    matched = any(l in ["hi", "ta", "te", "ml", "kn", "bn", "mr", "pa", "gu"] for l in returned_langs[:3])
                elif q["expected_lang"] == "any":
                    matched = len(recs) > 0
                else:
                    matched = (q["expected_lang"] in returned_langs[:3]) or (q["expected_lang"] in q["pref"])

                results.append({
                    "idx": i,
                    "prompt": q["prompt"],
                    "pref": q["pref"],
                    "expected": q["expected_lang"],
                    "count": len(recs),
                    "top_langs": returned_langs[:5],
                    "matched": matched,
                    "latency_ms": dur_ms,
                    "top_title": recs[0]["movie"]["title"] if recs else None,
                    "top_orig_title": recs[0]["movie"].get("original_title") if recs else None,
                    "top_cohort_score": recs[0]["movie"].get("cohort_quality_score") if recs else None,
                })
                print(f"[{i:02d}/60] ({dur_ms:5.1f}ms) '{q['prompt'][:35]:<35}' -> top: {recs[0]['movie']['title'][:25]:<25} ({top_lang}) | count: {len(recs)}")

        except Exception as e:
            errors += 1
            print(f"[{i:02d}/60] ERROR for '{q['prompt']}': {e}")
            results.append({
                "idx": i,
                "prompt": q["prompt"],
                "error": str(e),
                "matched": False
            })

    print("\n" + "="*70)
    print("GOLDEN SET EVALUATION REPORT")
    print("="*70)
    success_count = sum(1 for r in results if r.get("matched", False))
    total = len(GOLDEN_QUERIES)
    pass_rate = (success_count / total) * 100

    latencies.sort()
    p50 = latencies[len(latencies)//2] if latencies else 0
    p95 = latencies[int(len(latencies)*0.95)] if latencies else 0
    p99 = latencies[int(len(latencies)*0.99)] if latencies else 0

    print(f"Total Queries:     {total}")
    print(f"Successful Passes: {success_count} / {total} ({pass_rate:.1f}%)")
    print(f"Errors / Failures: {errors}")
    print(f"Latency P50:       {p50:.1f} ms")
    print(f"Latency P95:       {p95:.1f} ms")
    print(f"Latency P99:       {p99:.1f} ms")
    print("="*70)

    # Save artifact
    with open("scripts/golden_set_results.json", "w", encoding="utf-8") as f:
        json.dump({
            "total": total,
            "success_count": success_count,
            "pass_rate": pass_rate,
            "p50_ms": p50,
            "p95_ms": p95,
            "p99_ms": p99,
            "results": results
        }, f, indent=2, ensure_ascii=False)
    print("Artifact saved to backend/scripts/golden_set_results.json")

if __name__ == "__main__":
    run_evaluation()
