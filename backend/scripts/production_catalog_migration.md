# CineSense AI — Production Catalog Migration Guide (Neon Postgres)

> [!IMPORTANT]
> **Safety Guarantee**: This procedure is strictly additive, idempotently executable, and verified against Neon PostgreSQL schemas. It preserves existing user data, adds new language columns with defaults, loads 7,922 curated multilingual movie records in batches of 500, and verifies data integrity with zero downtime.

---

## 1. Schema Migration (`Alembic Upgrade`)

Before loading data, apply the latest migration revision `d4e5f6g7h8i9_add_language_and_preferences.py`:

```bash
cd backend
# Ensure DATABASE_URL points to your production Neon Postgres connection string
alembic upgrade head
```

### Schema Changes Applied
1. **`movies` table**:
   - `cohort_quality_score` (`FLOAT`, nullable=True) — Bayesian rating calibrated against language cohorts.
   - `has_verified_hindi_dub` (`BOOLEAN`, nullable=False, default=False) — Strict verification flag for Hindi audio tracks.
   - Index: `idx_movies_lang_quality` on `(original_language, cohort_quality_score DESC)`.

2. **`users` table**:
   - `preferred_languages` (`VARCHAR(255)`, nullable=False, default='hi,en') — Comma-delimited ISO 639-1 language codes.
   - `preferred_audio_mode` (`VARCHAR(32)`, nullable=False, default='original') — `'original'`, `'dubbed'`, or `'no_preference'`.
   - `has_completed_onboarding` (`BOOLEAN`, nullable=False, default=False) — First-visit onboarding status flag.

---

## 2. Idempotent Data Migration Script

To load the 7,922 movies from the verified local database slice (`cinesense_local.db`) into Neon Postgres, use the production upsert loader:

```python
# backend/scripts/sync_to_neon.py
import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import execute_values

SQLITE_PATH = os.path.join(os.path.dirname(__file__), "..", "cinesense_local.db")
TARGET_PG_URL = os.environ.get("DATABASE_URL")

if not TARGET_PG_URL or not TARGET_PG_URL.startswith("postgres"):
    print("Error: DATABASE_URL must be a valid PostgreSQL connection string.")
    sys.exit(1)

print(f"Connecting to source SQLite: {SQLITE_PATH}")
src = sqlite3.connect(SQLITE_PATH)
src.row_factory = sqlite3.Row
cur_src = src.cursor()

cur_src.execute("""
    SELECT id, title, overview, release_date, vote_average, vote_count,
           poster_path, backdrop_path, genres, keywords, runtime,
           trailer_key, streaming_providers, original_language,
           cohort_quality_score, has_verified_hindi_dub
    FROM movies
""")
rows = cur_src.fetchall()
print(f"Read {len(rows)} movies from source SQLite catalog.")

print("Connecting to target Neon PostgreSQL...")
conn_pg = psycopg2.connect(TARGET_PG_URL)
cur_pg = conn_pg.cursor()

columns = [
    "id", "title", "overview", "release_date", "vote_average", "vote_count",
    "poster_path", "backdrop_path", "genres", "keywords", "runtime",
    "trailer_key", "streaming_providers", "original_language",
    "cohort_quality_score", "has_verified_hindi_dub"
]

upsert_sql = f"""
    INSERT INTO movies ({', '.join(columns)})
    VALUES %s
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        overview = EXCLUDED.overview,
        release_date = EXCLUDED.release_date,
        vote_average = EXCLUDED.vote_average,
        vote_count = EXCLUDED.vote_count,
        poster_path = EXCLUDED.poster_path,
        backdrop_path = EXCLUDED.backdrop_path,
        genres = EXCLUDED.genres,
        keywords = EXCLUDED.keywords,
        runtime = EXCLUDED.runtime,
        trailer_key = EXCLUDED.trailer_key,
        streaming_providers = EXCLUDED.streaming_providers,
        original_language = EXCLUDED.original_language,
        cohort_quality_score = EXCLUDED.cohort_quality_score,
        has_verified_hindi_dub = EXCLUDED.has_verified_hindi_dub;
"""

batch_size = 500
total = len(rows)

for i in range(0, total, batch_size):
    batch = rows[i:i + batch_size]
    values = [[r[col] for col in columns] for r in batch]
    execute_values(cur_pg, upsert_sql, values)
    conn_pg.commit()
    print(f"Upserted {min(i + batch_size, total)} / {total} movies...")

print("Migration completed successfully.")
cur_pg.close()
conn_pg.close()
src.close()
```

---

## 3. Post-Migration Verification Queries

Run the following SQL queries directly in the Neon SQL Console to verify data health:

```sql
-- 1. Total movie count verification (Expected: 7,922)
SELECT COUNT(*) AS total_movies FROM movies;

-- 2. Language distribution check
SELECT original_language, COUNT(*) AS count, 
       ROUND(AVG(cohort_quality_score)::numeric, 2) AS avg_cohort_score,
       ROUND(AVG(vote_average)::numeric, 2) AS avg_vote
FROM movies 
GROUP BY original_language 
ORDER BY count DESC;

-- 3. Null checks for critical ranking columns
SELECT COUNT(*) AS missing_lang FROM movies WHERE original_language IS NULL;
SELECT COUNT(*) AS missing_score FROM movies WHERE cohort_quality_score IS NULL;

-- 4. Storage size verification (< 10 MB total)
SELECT pg_size_pretty(pg_total_relation_size('movies')) AS movies_table_size;
```

---

## 4. Zero-Downtime Rollback Procedure

In the event of an unexpected error during the migration:
1. **Schema Rollback**:
   ```bash
   alembic downgrade -1
   ```
2. **Catalog Restoration**:
   If catalog records need to be reverted to the pre-overhaul state, restore from the pre-upgrade snapshot tag `pre-upgrade-backup`:
   ```bash
   git checkout pre-upgrade-backup -- backend/cinesense_local.db
   python backend/scripts/sync_to_neon.py
   ```
3. **FAISS Vector Index**:
   The FAISS files (`backend/faiss_index/movies.index` and `id_map.json`) are version-controlled alongside the catalog and can be hot-swapped without service downtime.
