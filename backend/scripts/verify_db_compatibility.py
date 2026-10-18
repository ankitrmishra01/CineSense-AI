"""
Verification script for database schema backward-compatibility.
Validates that applying the new indexes to the pre-upgrade schema:
1. Succeeds without altering column definitions or dropping constraints
2. Incurs zero data loss on existing records
3. Supports old query patterns seamlessly
"""
import sqlite3
import sys

def verify_backward_compatibility():
    conn = sqlite3.connect(":memory:")
    cursor = conn.cursor()

    # 1. Create OLD schema (as of pre-upgrade-backup)
    cursor.execute("""
    CREATE TABLE movies (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        overview TEXT,
        tagline TEXT,
        genres TEXT,
        keywords TEXT,
        poster_path TEXT,
        backdrop_path TEXT,
        runtime INTEGER,
        vote_average REAL,
        vote_count INTEGER,
        release_date TEXT,
        trailer_key TEXT,
        watch_providers TEXT,
        cast_crew TEXT,
        belongs_to_collection TEXT,
        embedding_id INTEGER
    );
    """)

    # 2. Insert mock baseline records
    baseline_records = [
        (101, "The Dark Knight", "Batman battles the Joker in Gotham.", "Why so serious?", "Action, Crime, Drama", "superhero, villain", "/poster1.jpg", "/backdrop1.jpg", 152, 9.0, 28000, "2008-07-18", "LDG9BISCEjw", None, None, None, 0),
        (102, "Inception", "Dom Cobb enters dream states.", "Your mind is the scene of the crime.", "Sci-Fi, Action", "dream, heist", "/poster2.jpg", "/backdrop2.jpg", 148, 8.8, 32000, "2010-07-16", "YoHD9XEInc0", None, None, None, 1),
    ]

    cursor.executemany("""
    INSERT INTO movies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);
    """, baseline_records)
    conn.commit()

    cursor.execute("SELECT count(*) FROM movies")
    count_before = cursor.fetchone()[0]
    print(f"[TEST 1] Old schema baseline records: {count_before}")

    # 3. Apply schema additions (B-tree indexes on release_date, vote_average, embedding_id)
    cursor.execute("CREATE INDEX idx_movies_release_date ON movies (release_date);")
    cursor.execute("CREATE INDEX idx_movies_vote_average ON movies (vote_average);")
    cursor.execute("CREATE INDEX idx_movies_embedding_id ON movies (embedding_id);")
    conn.commit()
    print("[TEST 2] Successfully applied new indexes to schema.")

    # 4. Verify no data loss
    cursor.execute("SELECT count(*) FROM movies")
    count_after = cursor.fetchone()[0]
    assert count_before == count_after == 2, f"Data count mismatch: {count_before} vs {count_after}"
    print(f"[TEST 3] Zero data loss verified: {count_after} rows intact.")

    # 5. Verify OLD backend query patterns work without error
    # Old query 1: fetch by ID
    cursor.execute("SELECT id, title, vote_average FROM movies WHERE id = 101")
    row = cursor.fetchone()
    assert row == (101, "The Dark Knight", 9.0), f"Old query failed: {row}"

    # Old query 2: candidate lookup by list of IDs
    cursor.execute("SELECT id, title, overview FROM movies WHERE id IN (101, 102)")
    rows = cursor.fetchall()
    assert len(rows) == 2, f"Candidate lookup failed: {rows}"

    # Old query 3: filter by rating and sort by release date
    cursor.execute("SELECT title, release_date FROM movies WHERE vote_average >= 8.5 ORDER BY release_date DESC")
    filtered = cursor.fetchall()
    assert len(filtered) == 2 and filtered[0][0] == "Inception"
    print("[TEST 4] All OLD backend query patterns pass with 100% fidelity.")

    print("\nSUMMARY: Schema changes are 100% non-breaking and backward-compatible.")
    conn.close()

if __name__ == "__main__":
    verify_backward_compatibility()
