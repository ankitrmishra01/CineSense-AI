import os, requests, time, json

LIVE_URL = os.getenv('BENCHMARK_URL', 'https://cinesense-ai-teu4.onrender.com/recommend')

queries = [
    # English queries
    {'name': 'EN Short SciFi P1', 'payload': {'mood_text': 'dark sci-fi thriller', 'page': 1, 'limit': 20}},
    {'name': 'EN Short SciFi P2', 'payload': {'mood_text': 'dark sci-fi thriller', 'page': 2, 'limit': 20}},
    {'name': 'EN Short SciFi P3', 'payload': {'mood_text': 'dark sci-fi thriller', 'page': 3, 'limit': 20}},
    {'name': 'EN Short SciFi P4', 'payload': {'mood_text': 'dark sci-fi thriller', 'page': 4, 'limit': 20}},
    {'name': 'EN Long Family P1', 'payload': {'mood_text': 'a thoughtful psychological drama about family secrets and forgiveness', 'page': 1, 'limit': 20}},
    {'name': 'EN Long Family P2', 'payload': {'mood_text': 'a thoughtful psychological drama about family secrets and forgiveness', 'page': 2, 'limit': 20}},
    {'name': 'EN Comedy Rating 7+ P1', 'payload': {'mood_text': 'fun comedy', 'filters': {'min_rating': 7.0}, 'page': 1, 'limit': 20}},
    {'name': 'EN Space Year 2015+ P1', 'payload': {'mood_text': 'space exploration', 'filters': {'min_year': 2015}, 'page': 1, 'limit': 20}},
    {'name': 'EN Fast Action Runtime 100 P1', 'payload': {'mood_text': 'fast action thriller', 'filters': {'max_runtime': 100}, 'page': 1, 'limit': 20}},
    {'name': 'EN High Rating 8.0+ P1', 'payload': {'mood_text': 'masterpiece film', 'filters': {'min_rating': 8.0}, 'page': 1, 'limit': 20}},
    
    # Hindi queries
    {'name': 'HI Dosti P1', 'payload': {'mood_text': 'सच्ची दोस्ती और मस्ती', 'page': 1, 'limit': 20}},
    {'name': 'HI Dosti P2', 'payload': {'mood_text': 'सच्ची दोस्ती और मस्ती', 'page': 2, 'limit': 20}},
    {'name': 'HI Romance P1', 'payload': {'mood_text': 'रोमांटिक ड्रामा प्रेम कहानी', 'page': 1, 'limit': 20}},
    {'name': 'HI Long Drama P1', 'payload': {'mood_text': 'एक छोटे शहर की सच्ची प्रेम कहानी और संघर्ष', 'page': 1, 'limit': 20}},
    {'name': 'HI Crime Filter P1', 'payload': {'mood_text': 'crime thriller', 'filters': {'original_language': 'hi'}, 'page': 1, 'limit': 20}},
    {'name': 'HI Crime Filter P2', 'payload': {'mood_text': 'crime thriller', 'filters': {'original_language': 'hi'}, 'page': 2, 'limit': 20}},
    {'name': 'HI Crime Filter P3', 'payload': {'mood_text': 'crime thriller', 'filters': {'original_language': 'hi'}, 'page': 3, 'limit': 20}},
    
    # Hinglish queries
    {'name': 'Hinglish Suspense P1', 'payload': {'mood_text': 'koi zabardast suspense thriller batao', 'page': 1, 'limit': 20}},
    {'name': 'Hinglish Suspense P2', 'payload': {'mood_text': 'koi zabardast suspense thriller batao', 'page': 2, 'limit': 20}},
    {'name': 'Hinglish Comedy P1', 'payload': {'mood_text': 'hasne wali mast comedy movie chahiye', 'page': 1, 'limit': 20}},
    {'name': 'Hinglish Emotional P1', 'payload': {'mood_text': 'emotional rone wali family movie', 'page': 1, 'limit': 20}},
    {'name': 'Hinglish Action Pref P1', 'payload': {'mood_text': 'dhamakedar action film', 'preferred_languages': ['hi'], 'page': 1, 'limit': 20}},
    
    # Tamil queries
    {'name': 'TA Action P1', 'payload': {'mood_text': 'விறுவிறுப்பான ஆக்ஷன் படம்', 'page': 1, 'limit': 20}},
    {'name': 'TA Action P2', 'payload': {'mood_text': 'விறுவிறுப்பான ஆக்ஷன் படம்', 'page': 2, 'limit': 20}},
    {'name': 'TA Mass Filter P1', 'payload': {'mood_text': 'mass action entertainer', 'filters': {'original_language': 'ta'}, 'page': 1, 'limit': 20}},
    {'name': 'TA Mass Filter P2', 'payload': {'mood_text': 'mass action entertainer', 'filters': {'original_language': 'ta'}, 'page': 2, 'limit': 20}},
    {'name': 'TA Mystery Filter P1', 'payload': {'mood_text': 'detective mystery', 'filters': {'original_language': 'ta'}, 'page': 1, 'limit': 20}},
    
    # Telugu, Malayalam, Kannada
    {'name': 'TE Romance P1', 'payload': {'mood_text': 'మంచి ప్రేమకథ సినిమా', 'page': 1, 'limit': 20}},
    {'name': 'TE Political Filter P1', 'payload': {'mood_text': 'political drama', 'filters': {'original_language': 'te'}, 'page': 1, 'limit': 20}},
    {'name': 'ML Realistic Filter P1', 'payload': {'mood_text': 'realistic slice of life drama', 'filters': {'original_language': 'ml'}, 'page': 1, 'limit': 20}},
    {'name': 'KN Action Filter P1', 'payload': {'mood_text': 'heroic action drama', 'filters': {'original_language': 'kn'}, 'page': 1, 'limit': 20}},
    
    # Korean & Japanese
    {'name': 'KO Thriller P1', 'payload': {'mood_text': '반전 있는 스릴러 영화', 'page': 1, 'limit': 20}},
    {'name': 'KO Revenge Filter P1', 'payload': {'mood_text': 'intense revenge story', 'filters': {'original_language': 'ko'}, 'page': 1, 'limit': 20}},
    {'name': 'JA Anime Fantasy P1', 'payload': {'mood_text': 'ghibli style cozy fantasy', 'filters': {'original_language': 'ja'}, 'page': 1, 'limit': 20}},
    
    # Multilingual preference queries
    {'name': 'Multi-Lang Pref P1', 'payload': {'mood_text': 'mind bending mystery', 'preferred_languages': ['en', 'hi', 'ta'], 'page': 1, 'limit': 20}},
    {'name': 'Multi-Lang Pref P2', 'payload': {'mood_text': 'mind bending mystery', 'preferred_languages': ['en', 'hi', 'ta'], 'page': 2, 'limit': 20}},
    {'name': 'Multi-Lang Pref P3', 'payload': {'mood_text': 'mind bending mystery', 'preferred_languages': ['en', 'hi', 'ta'], 'page': 3, 'limit': 20}},
    
    # Similar to & High Limit
    {'name': 'Similar Inception P1', 'payload': {'mood_text': 'movies like Inception', 'page': 1, 'limit': 20}},
    {'name': 'Similar Sholay P1', 'payload': {'mood_text': 'movies like Sholay', 'page': 1, 'limit': 20}},
    {'name': 'Limit 30 Romance P1', 'payload': {'mood_text': 'feel good romance', 'page': 1, 'limit': 30}}
]

if __name__ == '__main__':
    import sys
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    print(f"Running {len(queries)} queries against {LIVE_URL} ...\n", flush=True)
    results = []
    fewer_count = 0
    notices_count = 0

    for idx, q in enumerate(queries, 1):
        payload = q['payload']
        limit_req = payload.get('limit', 20)
        page_req = payload.get('page', 1)
        name = q['name']
        t0 = time.perf_counter()
        try:
            r = requests.post(LIVE_URL, json=payload, timeout=25)
            dt = (time.perf_counter() - t0) * 1000
            if r.status_code == 200:
                data = r.json()
                returned = len(data.get('recommendations', []))
                total = data.get('total_results', 0)
                notice = data.get('filter_notice')
                if notice:
                    notices_count += 1
                is_fewer = returned < limit_req
                if is_fewer:
                    fewer_count += 1
                results.append({
                    'idx': idx,
                    'name': name,
                    'status': 200,
                    'limit_requested': limit_req,
                    'returned': returned,
                    'total_results': total,
                    'latency_ms': round(dt, 1),
                    'fewer': is_fewer,
                    'notice': notice,
                })
                flag = '[FEWER]' if is_fewer else '[OK]'
                notice_str = f' [Notice: {notice}]' if notice else ''
                print(f"[{idx:02d}/40] {name:<30} -> returned: {returned:2d}/{limit_req:2d} (total: {total:3d}) in {dt:4.0f}ms {flag}{notice_str}", flush=True)
            else:
                print(f"[{idx:02d}/40] {name:<30} -> ERROR {r.status_code} in {dt:4.0f}ms", flush=True)
                results.append({'idx': idx, 'name': name, 'status': r.status_code, 'limit_requested': limit_req, 'returned': 0, 'latency_ms': round(dt, 1), 'fewer': True, 'notice': None})
                fewer_count += 1
        except Exception as e:
            print(f"[{idx:02d}/40] {name:<30} -> TIMEOUT/EXCEPTION {e}", flush=True)
            results.append({'idx': idx, 'name': name, 'status': 0, 'limit_requested': limit_req, 'returned': 0, 'latency_ms': 0, 'fewer': True, 'notice': None})
            fewer_count += 1

    print('\n======================================================', flush=True)
    print('40 QUERIES BENCHMARK SUMMARY', flush=True)
    print('======================================================', flush=True)
    print(f"Total queries tested: {len(queries)}", flush=True)
    print(f"Queries returning full limit: {len(queries) - fewer_count}", flush=True)
    print(f"Queries returning fewer than limit: {fewer_count}", flush=True)
    print(f"Queries with transparent filter_notice: {notices_count}", flush=True)


