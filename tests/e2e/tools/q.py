import sqlite3, sys, json
# usage: q.py <db> <sql> [json-params]   -> prints rows as JSON (read-only)
db, sql = sys.argv[1], sys.argv[2]
params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else []
con = sqlite3.connect('file:' + db.replace('\\', '/') + '?mode=ro', uri=True, timeout=10)
con.row_factory = sqlite3.Row
cur = con.execute(sql, params)
print(json.dumps([dict(r) for r in cur.fetchall()], default=str))
