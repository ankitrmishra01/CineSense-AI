import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import json
import time
import sqlite3
from typing import List, Dict, Any, Optional

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Connect to DB and FAISS service directly or via HTTP
import urllib.request
import urllib.error

API_URL = "http://127.0.0.1:8000/recommend"

# 60 FIXED BENCHMARK QUERIES
BENCHMARK_60 = [
    # ── Category 1: English (15 Queries) ──
    {
        "id": "EN-01",
        "category": "English",
        "prompt": "mind-bending sci-fi with philosophical concepts",
        "expected_genres": ["Science Fiction", "Mystery", "Drama"],
        "expected_langs": ["en"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-02",
        "category": "English",
        "prompt": "melancholic rainy night comfort movie",
        "expected_genres": ["Drama", "Romance"],
        "expected_langs": ["en", "ja", "ko"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-03",
        "category": "English",
        "prompt": "intense psychological thriller with shocking plot twist",
        "expected_genres": ["Thriller", "Mystery"],
        "expected_langs": ["en", "ko"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-04",
        "category": "English",
        "prompt": "laugh out loud buddy comedy",
        "expected_genres": ["Comedy"],
        "expected_langs": ["en"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-05",
        "category": "English",
        "prompt": "gritty realistic crime detective noir",
        "expected_genres": ["Crime", "Thriller", "Mystery"],
        "expected_langs": ["en"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-06",
        "category": "English",
        "prompt": "haunting atmospheric horror in isolated house",
        "expected_genres": ["Horror", "Mystery"],
        "expected_langs": ["en"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-07",
        "category": "English",
        "prompt": "epic space exploration and survival against odds",
        "expected_genres": ["Science Fiction", "Adventure"],
        "expected_langs": ["en"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-08",
        "category": "English",
        "prompt": "heartwarming coming of age summer romance",
        "expected_genres": ["Romance", "Drama", "Comedy"],
        "expected_langs": ["en"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-09",
        "category": "English",
        "prompt": "high stakes courtroom drama and moral dilemma",
        "expected_genres": ["Drama", "Crime"],
        "expected_langs": ["en"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-10",
        "category": "English",
        "prompt": "relentless action movie with incredible choreography",
        "expected_genres": ["Action", "Thriller"],
        "expected_langs": ["en", "id", "ko"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-11",
        "category": "English",
        "prompt": "cynical political satire and journalism investigation",
        "expected_genres": ["Drama", "Comedy", "History"],
        "expected_langs": ["en"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-12",
        "category": "English",
        "prompt": "underdog sports story overcoming all obstacles",
        "expected_genres": ["Drama"],
        "expected_langs": ["en"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-13",
        "category": "English",
        "prompt": "time travel paradox and altered timelines",
        "expected_genres": ["Science Fiction", "Thriller"],
        "expected_langs": ["en"],
        "min_rating": 6.0,
    },
    {
        "id": "EN-14",
        "category": "English",
        "prompt": "bittersweet divorce and family reconciliation",
        "expected_genres": ["Drama"],
        "expected_langs": ["en", "fr"],
        "min_rating": 6.5,
    },
    {
        "id": "EN-15",
        "category": "English",
        "prompt": "whimsical fantasy adventure with talking animals",
        "expected_genres": ["Animation", "Fantasy", "Family"],
        "expected_langs": ["en", "ja"],
        "min_rating": 6.0,
    },

    # ── Category 2: Hindi & Hinglish (15 Queries) ──
    {
        "id": "HI-01",
        "category": "Hindi",
        "prompt": "हॉरर कॉमेडी फिल्में",
        "expected_genres": ["Horror", "Comedy"],
        "expected_langs": ["hi"],
        "min_rating": 5.5,
    },
    {
        "id": "HI-02",
        "category": "Hindi",
        "prompt": "दिल को छू लेने वाली प्रेम कहानी",
        "expected_genres": ["Romance", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-03",
        "category": "Hindi",
        "prompt": "रोमांचक सस्पेंस मर्डर मिस्ट्री",
        "expected_genres": ["Mystery", "Thriller", "Crime"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-04",
        "category": "Hindi",
        "prompt": "परिवार के साथ देखने वाली हंसी की फिल्म",
        "expected_genres": ["Comedy", "Family", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-05",
        "category": "Hindi",
        "prompt": "देशभक्ति और सेना की सच्ची कहानी",
        "expected_genres": ["Action", "Drama", "History", "War"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-06",
        "category": "Hindi",
        "prompt": "koi badhiya suspense thriller movie batao",
        "expected_genres": ["Mystery", "Thriller", "Crime"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-07",
        "category": "Hindi",
        "prompt": "dost ke sath dekhne wali mast bollywood comedy",
        "expected_genres": ["Comedy", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-08",
        "category": "Hindi",
        "prompt": "pyar aur dard wali emotional movie",
        "expected_genres": ["Romance", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-09",
        "category": "Hindi",
        "prompt": "bhai action movie chahiye dhoom dhadaka",
        "expected_genres": ["Action", "Thriller"],
        "expected_langs": ["hi", "te"],
        "min_rating": 5.5,
    },
    {
        "id": "HI-10",
        "category": "Hindi",
        "prompt": "dimag hila dene wali psychological movie",
        "expected_genres": ["Thriller", "Mystery"],
        "expected_langs": ["hi", "en"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-11",
        "category": "Hindi",
        "prompt": "gangster underworld raw crime like Anurag Kashyap",
        "expected_genres": ["Crime", "Drama", "Action"],
        "expected_langs": ["hi"],
        "min_rating": 6.5,
    },
    {
        "id": "HI-12",
        "category": "Hindi",
        "prompt": "social issue comedy drama like Rajkumar Hirani",
        "expected_genres": ["Comedy", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.5,
    },
    {
        "id": "HI-13",
        "category": "Hindi",
        "prompt": "college romance and friendship nostalgia",
        "expected_genres": ["Romance", "Comedy", "Drama"],
        "expected_langs": ["hi"],
        "min_rating": 6.0,
    },
    {
        "id": "HI-14",
        "category": "Hindi",
        "prompt": "courtroom battle for justice in India",
        "expected_genres": ["Drama", "Crime"],
        "expected_langs": ["hi", "ta"],
        "min_rating": 6.5,
    },
    {
        "id": "HI-15",
        "category": "Hindi",
        "prompt": "sports underdog biopics Bollywood",
        "expected_genres": ["Drama", "Action"],
        "expected_langs": ["hi"],
        "min_rating": 6.5,
    },

    # ── Category 3: Regional Indian (Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, Punjabi) (15 Queries) ──
    {
        "id": "REG-01",
        "category": "Regional Indian",
        "prompt": "திருப்பங்கள் நிறைந்த அதிரடி திரைப்படம்",
        "expected_genres": ["Action", "Thriller", "Crime"],
        "expected_langs": ["ta"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-02",
        "category": "Regional Indian",
        "prompt": "குடும்ப நகைச்சுவை திரைப்படம்",
        "expected_genres": ["Comedy", "Family", "Drama"],
        "expected_langs": ["ta"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-03",
        "category": "Regional Indian",
        "prompt": "grounded kollywood crime investigation thriller",
        "expected_genres": ["Crime", "Thriller", "Mystery"],
        "expected_langs": ["ta"],
        "min_rating": 6.5,
    },
    {
        "id": "REG-04",
        "category": "Regional Indian",
        "prompt": "masterpieces of Mani Ratnam",
        "expected_genres": ["Drama", "Romance", "Action"],
        "expected_langs": ["ta", "hi"],
        "min_rating": 7.0,
    },
    {
        "id": "REG-05",
        "category": "Regional Indian",
        "prompt": "మంచి ప్రేమ కథ మరియు భావోద్వేగ చిత్రం",
        "expected_genres": ["Romance", "Drama"],
        "expected_langs": ["te"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-06",
        "category": "Regional Indian",
        "prompt": "భారీ యాక్షన్ మరియు సస్పెన్స్ సినిమా",
        "expected_genres": ["Action", "Thriller"],
        "expected_langs": ["te"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-07",
        "category": "Regional Indian",
        "prompt": "grand visual spectacles by SS Rajamouli",
        "expected_genres": ["Action", "Drama", "Fantasy"],
        "expected_langs": ["te"],
        "min_rating": 7.0,
    },
    {
        "id": "REG-08",
        "category": "Regional Indian",
        "prompt": "മനോഹരമായ കുടുംബ ചിത്രം",
        "expected_genres": ["Family", "Drama"],
        "expected_langs": ["ml"],
        "min_rating": 6.5,
    },
    {
        "id": "REG-09",
        "category": "Regional Indian",
        "prompt": "കുറ്റാന്വേഷണ ത്രില്ലർ",
        "expected_genres": ["Crime", "Thriller", "Mystery"],
        "expected_langs": ["ml"],
        "min_rating": 6.5,
    },
    {
        "id": "REG-10",
        "category": "Regional Indian",
        "prompt": "realistic mollywood subtle drama like Dileesh Pothan",
        "expected_genres": ["Drama", "Comedy", "Crime"],
        "expected_langs": ["ml"],
        "min_rating": 6.5,
    },
    {
        "id": "REG-11",
        "category": "Regional Indian",
        "prompt": "ಉತ್ತಮ ಕೌಟುಂಬಿಕ ಹಾಸ್ಯ ಚಲನಚಿತ್ರ",
        "expected_genres": ["Comedy", "Family", "Drama"],
        "expected_langs": ["kn"],
        "min_rating": 5.5,
    },
    {
        "id": "REG-12",
        "category": "Regional Indian",
        "prompt": "epic sandalwood folklore action drama",
        "expected_genres": ["Action", "Drama", "Fantasy"],
        "expected_langs": ["kn"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-13",
        "category": "Regional Indian",
        "prompt": "ভালোবাসার রোমান্টিক সিনেমা",
        "expected_genres": ["Romance", "Drama"],
        "expected_langs": ["bn"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-14",
        "category": "Regional Indian",
        "prompt": "गंभीर भावनिक मराठी चित्रपट",
        "expected_genres": ["Drama"],
        "expected_langs": ["mr"],
        "min_rating": 6.0,
    },
    {
        "id": "REG-15",
        "category": "Regional Indian",
        "prompt": "ਦਿਲਚਸਪ ਪੰਜਾਬੀ ਕਾਮੇਡੀ",
        "expected_genres": ["Comedy"],
        "expected_langs": ["pa"],
        "min_rating": 5.5,
    },

    # ── Category 4: International & World Cinema (15 Queries) ──
    {
        "id": "INT-01",
        "category": "International",
        "prompt": "긴장감 넘치는 심리 스릴러",
        "expected_genres": ["Thriller", "Mystery"],
        "expected_langs": ["ko"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-02",
        "category": "International",
        "prompt": "감동적인 로맨스 영화",
        "expected_genres": ["Romance", "Drama"],
        "expected_langs": ["ko"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-03",
        "category": "International",
        "prompt": "social satire dark comedy like Bong Joon-ho",
        "expected_genres": ["Drama", "Comedy", "Thriller"],
        "expected_langs": ["ko"],
        "min_rating": 7.0,
    },
    {
        "id": "INT-04",
        "category": "International",
        "prompt": "korean revenge noir with visceral action",
        "expected_genres": ["Action", "Thriller", "Crime"],
        "expected_langs": ["ko"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-05",
        "category": "International",
        "prompt": "心を揺さぶる感動のアニメ映画",
        "expected_genres": ["Animation", "Drama", "Fantasy"],
        "expected_langs": ["ja"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-06",
        "category": "International",
        "prompt": "whimsical magical studio ghibli anime like Miyazaki",
        "expected_genres": ["Animation", "Fantasy", "Family"],
        "expected_langs": ["ja"],
        "min_rating": 7.0,
    },
    {
        "id": "INT-07",
        "category": "International",
        "prompt": "quiet japanese slice of life family drama",
        "expected_genres": ["Drama"],
        "expected_langs": ["ja"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-08",
        "category": "International",
        "prompt": "película de suspenso y misterio en español",
        "expected_genres": ["Thriller", "Mystery"],
        "expected_langs": ["es"],
        "min_rating": 6.0,
    },
    {
        "id": "INT-09",
        "category": "International",
        "prompt": "spanish dark psychological crime twist",
        "expected_genres": ["Mystery", "Thriller", "Crime"],
        "expected_langs": ["es"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-10",
        "category": "International",
        "prompt": "film français romantique et poétique",
        "expected_genres": ["Romance", "Drama", "Comedy"],
        "expected_langs": ["fr"],
        "min_rating": 6.0,
    },
    {
        "id": "INT-11",
        "category": "International",
        "prompt": "french elegant coming of age drama",
        "expected_genres": ["Drama"],
        "expected_langs": ["fr"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-12",
        "category": "International",
        "prompt": "haunting scandinavian noir crime mystery",
        "expected_genres": ["Crime", "Mystery", "Thriller"],
        "expected_langs": ["da", "sv", "no", "en"],
        "min_rating": 6.0,
    },
    {
        "id": "INT-13",
        "category": "International",
        "prompt": "gritty martial arts action with ruthless stunts",
        "expected_genres": ["Action"],
        "expected_langs": ["zh", "cn", "id", "th", "ko"],
        "min_rating": 6.0,
    },
    {
        "id": "INT-14",
        "category": "International",
        "prompt": "existential european arthouse cinema",
        "expected_genres": ["Drama"],
        "expected_langs": ["fr", "it", "de", "es"],
        "min_rating": 6.5,
    },
    {
        "id": "INT-15",
        "category": "International",
        "prompt": "dramatic latin american survival journey",
        "expected_genres": ["Drama", "Adventure"],
        "expected_langs": ["es", "pt"],
        "min_rating": 6.0,
    },
]

def evaluate_movie_relevance(movie: Dict[str, Any], query_spec: Dict[str, Any], user_prefs: Optional[List[str]] = None) -> tuple[bool, str]:
    """
    Explicit Relevance Rules:
    1. Rating Floor: vote_average >= min_rating - 0.4
    2. Genre/Theme Match: movie has at least 1 genre matching expected_genres (or prompt keywords in overview)
    3. Language Consistency:
       - If prompt has native script or explicit language/industry nickname, strict language match is required.
       - If generic English mood query with user preferences (Setting C), user's preferred languages are also valid.
    """
    genres = [g.get("name") if isinstance(g, dict) else str(g) for g in (movie.get("genres") or [])]
    vote_avg = float(movie.get("vote_average") or 0.0)
    lang = movie.get("original_language", "en")
    overview = (movie.get("overview") or "").lower()
    title = (movie.get("title") or "").lower()

    # Rule 1: Rating Floor
    if vote_avg < (query_spec["min_rating"] - 0.4):
        return False, f"Low rating ({vote_avg} < {query_spec['min_rating']})"

    # Rule 2: Genre or Theme overlap
    expected_genres = set(query_spec["expected_genres"])
    genre_match = bool(set(genres) & expected_genres)
    theme_match = any(w.lower() in overview or w.lower() in title for w in query_spec["expected_genres"])
    if not (genre_match or theme_match):
        return False, f"Genre mismatch (movie genres: {genres}, expected: {query_spec['expected_genres']})"

    # Rule 3: Language Match
    prompt = query_spec["prompt"].lower()
    has_explicit_script = any(ord(c) > 127 for c in query_spec["prompt"])
    has_explicit_lang_word = any(w in prompt for w in ["spanish", "español", "french", "français", "korean", "anime", "bollywood", "tollywood", "kollywood", "mollywood", "sandalwood"])

    if has_explicit_script or has_explicit_lang_word:
        expected_langs = query_spec["expected_langs"]
        if expected_langs and lang not in expected_langs:
            return False, f"Language mismatch ({lang} not in {expected_langs})"
    else:
        valid_langs = set(query_spec["expected_langs"])
        if user_prefs:
            valid_langs.update(user_prefs)
        if lang not in valid_langs and valid_langs:
            return False, f"Language mismatch ({lang} not in {valid_langs})"

    return True, "Relevant"

def run_query_against_api(prompt: str, prefs: List[str]) -> tuple[List[Dict[str, Any]], float, Optional[str]]:
    payload = {
        "mood_text": prompt,
        "preferred_languages": prefs,
        "limit": 10
    }
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = (time.time() - t0) * 1000
            recs = data.get("recommendations", [])
            movies = [r.get("movie") for r in recs if r.get("movie")]
            return movies, elapsed, None
    except Exception as e:
        elapsed = (time.time() - t0) * 1000
        return [], elapsed, str(e)

def run_baseline_query(prompt: str) -> tuple[List[Dict[str, Any]], float, Optional[str]]:
    """
    Setting A: Pre-upgrade baseline
    - No Groq translation (embeds raw prompt text directly)
    - Raw vote_average (no Bayesian cohort quality score)
    - No language preference boost
    - No diversity re-ranking
    """
    from app.services.faiss_service import search as faiss_search
    from app.services.ranking_service import compute_hybrid_score
    import sqlite3
    from datetime import datetime

    t0 = time.time()
    try:
        similar = faiss_search(prompt, top_k=60)
        if not similar:
            return [], (time.time() - t0) * 1000, None

        sim_map = {tmdb_id: sim for tmdb_id, sim in similar}
        ids = list(sim_map.keys())

        conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), "..", "cinesense_local.db"))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        placeholders = ",".join("?" * len(ids))
        cursor.execute(f"SELECT * FROM movies WHERE id IN ({placeholders})", ids)
        rows = cursor.fetchall()
        conn.close()

        scored = []
        for r in rows:
            m = dict(r)
            if m.get("genres"):
                try:
                    m["genres"] = json.loads(m["genres"])
                except Exception:
                    m["genres"] = []
            sim = sim_map.get(m["id"], 0.5)
            rel_year = None
            if m.get("release_date") and len(str(m["release_date"])) >= 4:
                try:
                    rel_year = int(str(m["release_date"])[:4])
                except Exception:
                    pass

            score = compute_hybrid_score(
                similarity_score=sim,
                vote_average=m.get("vote_average"),
                vote_count=m.get("vote_count"),
                release_year=rel_year,
                cohort_quality_score=None, # Baseline had NO Bayesian cohort score
                original_language=m.get("original_language"),
                preferred_languages=None,  # Baseline had NO language preferences
            )
            m["final_score"] = score
            scored.append(m)

        scored.sort(key=lambda x: x["final_score"], reverse=True)
        return scored[:10], (time.time() - t0) * 1000, None
    except Exception as e:
        return [], (time.time() - t0) * 1000, str(e)

def run_full_benchmark():
    print("=" * 80)
    print("🎬 CineSense AI — 60-Query Precision@10 Benchmark Across 3 Settings")
    print("=" * 80)

    settings_to_test = [
        {"name": "Setting A (Baseline No-Language)", "prefs": [], "is_baseline": True},
        {"name": "Setting B (Language-Aware, No Pref)", "prefs": [], "is_baseline": False},
        {"name": "Setting C (Language-Aware, Pref=[hi, ta])", "prefs": ["hi", "ta"], "is_baseline": False},
    ]

    all_results = {}

    for s in settings_to_test:
        s_name = s["name"]
        prefs = s["prefs"]
        is_baseline = s["is_baseline"]
        print(f"\n▶ Running benchmark for: {s_name}...")

        cat_precisions = {"English": [], "Hindi": [], "Regional Indian": [], "International": []}
        all_precisions = []
        lang_distribution = {}
        query_details = []
        latencies = []

        for q in BENCHMARK_60:
            if is_baseline:
                movies, latency_ms, error = run_baseline_query(q["prompt"])
            else:
                movies, latency_ms, error = run_query_against_api(q["prompt"], prefs)
            latencies.append(latency_ms)

            if error:
                print(f"  ✗ {q['id']} ({q['category']}): ERROR {error}")
                all_precisions.append(0.0)
                cat_precisions[q["category"]].append(0.0)
                query_details.append({
                    "id": q["id"],
                    "category": q["category"],
                    "prompt": q["prompt"],
                    "p10": 0.0,
                    "error": error,
                    "top_titles": []
                })
                continue

            # Evaluate top 10 movies
            top10 = movies[:10]
            relevant_count = 0
            titles_debug = []

            for m in top10:
                is_rel, reason = evaluate_movie_relevance(m, q, user_prefs=prefs)
                lang = m.get("original_language", "other")
                lang_distribution[lang] = lang_distribution.get(lang, 0) + 1
                if is_rel:
                    relevant_count += 1
                titles_debug.append(f"{m.get('title')} ({lang}, {m.get('vote_average')}) [{reason}]")

            p10 = relevant_count / max(len(top10), 1)
            all_precisions.append(p10)
            cat_precisions[q["category"]].append(p10)
            query_details.append({
                "id": q["id"],
                "category": q["category"],
                "prompt": q["prompt"],
                "p10": p10,
                "latency_ms": latency_ms,
                "top_titles": titles_debug[:3]
            })
            if not is_baseline:
                time.sleep(0.15)  # Pacing to stay comfortably under Groq token rate limits
            if (len(all_precisions) % 15 == 0) or (len(all_precisions) == len(BENCHMARK_60)):
                print(f"    [{q['id']}] Completed {len(all_precisions)}/60 queries (P@10 = {p10:.2f})", flush=True)

        overall_p10 = sum(all_precisions) / len(all_precisions) if all_precisions else 0.0
        avg_latency = sum(latencies) / len(latencies) if latencies else 0.0

        all_results[s_name] = {
            "overall_p10": overall_p10,
            "avg_latency_ms": avg_latency,
            "category_p10": {cat: sum(vals)/len(vals) if vals else 0.0 for cat, vals in cat_precisions.items()},
            "lang_distribution": lang_distribution,
            "query_details": query_details
        }

        print(f"  ✓ {s_name} Complete: Overall P@10 = {overall_p10:.3f}, Avg Latency = {avg_latency:.1f}ms")
        for cat, val in all_results[s_name]["category_p10"].items():
            print(f"      - {cat}: P@10 = {val:.3f}")

    # Save benchmark json
    out_path = os.path.join(os.path.dirname(__file__), "benchmark_60_results.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2, ensure_ascii=False)
    print(f"\nSaved raw benchmark results to: {out_path}")

    # Analyze 10 Worst Queries from Setting B & C
    print("\n" + "=" * 80)
    print("🔍 10 WORST QUERIES ANALYSIS (Setting C: Hindi + Tamil Preferences)")
    print("=" * 80)
    c_details = sorted(all_results["Setting C (Language-Aware, Pref=[hi, ta])"]["query_details"], key=lambda x: x["p10"])
    worst_10 = c_details[:10]
    for i, w in enumerate(worst_10, 1):
        print(f"{i:2d}. [{w['id']}] Category: {w['category']} | P@10: {w['p10']:.2f}")
        print(f"    Prompt: \"{w['prompt']}\"")
        print(f"    Top Results: {w['top_titles']}")

    return all_results

def test_real_groq_api():
    print("\n" + "=" * 80)
    print("🤖 LIVE GROQ TRANSLATION API EMPIRICAL TEST (Hinglish, Hindi, Tamil)")
    print("=" * 80)
    import asyncio
    from app.services.language_service import translate_and_understand_query

    test_queries = [
        {"type": "Hinglish", "text": "dost ke sath dekhne wali mast romantic comedy movie"},
        {"type": "Hindi Script", "text": "रोमांचक सस्पेंस मर्डर मिस्ट्री"},
        {"type": "Tamil Script", "text": "திருப்பங்கள் நிறைந்த அதிரடி திரைப்படம்"},
    ]

    for t in test_queries:
        t0 = time.time()
        res = asyncio.run(translate_and_understand_query(t["text"]))
        latency_ms = (time.time() - t0) * 1000
        print(f"\n[{t['type']}]")
        print(f"  Input Prompt:      \"{t['text']}\"")
        print(f"  Detected Lang:     {res.get('detected_language')}")
        print(f"  Groq Translation:  \"{res.get('translated_text')}\"")
        print(f"  Latency:           {latency_ms:.1f}ms")

if __name__ == "__main__":
    benchmark_data = run_full_benchmark()
    test_real_groq_api()
