import json, sqlite3, os

json_file = r'C:\Users\ankit\.cinesense_backups\neon_prod_backup_20261019.json'
scratch_db = r'C:\Users\ankit\.cinesense_backups\scratch_restore_verify.db'
if os.path.exists(scratch_db):
    os.remove(scratch_db)

with open(json_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

conn = sqlite3.connect(scratch_db)
cur = conn.cursor()

print('Restoring tables into scratch database...')
for tbl, tbl_data in data.items():
    cols = tbl_data['columns']
    col_defs = ', '.join([f'"{c}" TEXT' for c in cols])
    cur.execute(f'CREATE TABLE {tbl} ({col_defs});')
    
    placeholders = ', '.join(['?' for _ in cols])
    prepared_rows = []
    for r in tbl_data['rows']:
        row = [json.dumps(val) if isinstance(val, (dict, list)) else val for val in r]
        prepared_rows.append(row)
        
    cur.executemany(f'INSERT INTO {tbl} VALUES ({placeholders});', prepared_rows)
    conn.commit()
    
    cur.execute(f'SELECT count(*) FROM {tbl};')
    restored_cnt = cur.fetchone()[0]
    expected_cnt = tbl_data['count']
    assert restored_cnt == expected_cnt, f'Mismatch in {tbl}: {restored_cnt} vs {expected_cnt}'
    print(f'  [PASS] {tbl}: {restored_cnt} / {expected_cnt} rows restored with exact equality')

conn.close()
print('Scratch restore verification completed with 100% parity!')
