import urllib.request
import json

queries = [
    {"mood_text": "best mollywood mystery thriller", "preferred_languages": ["ml", "hi", "en"]},
    {"mood_text": "हॉरर कॉमेडी फिल्में", "preferred_languages": ["hi", "en"]},
    {"mood_text": "romantic tollywood cinema", "preferred_languages": ["te", "en"]},
]

for q in queries:
    print(f"\n=== Query: {q['mood_text']} ===")
    req = urllib.request.Request(
        "http://127.0.0.1:8000/recommend",
        data=json.dumps(q).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read())
    recs = data.get("recommendations", [])
    print(f"Recs count: {len(recs)}")
    for r in recs[:5]:
        m = r["movie"]
        print(f"- {m['title']} ({m['original_language']}) | Match: {r['match_percentage']}% | Score: {r['similarity_score']} | Cohort: {m.get('cohort_quality_score')}")
