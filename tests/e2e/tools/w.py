import sqlite3, sys, json
# usage: w.py <db> <sql> [json-params] -> executes write query and prints rowcount/lastrowid
db, sql = sys.argv[1], sys.argv[2]
params = json.loads(sys.argv[3]) if len(sys.argv) > 3 else []
con = sqlite3.connect(db, timeout=15)
cur = con.execute(sql, params)
con.commit()
print(json.dumps({"changes": cur.rowcount, "lastrowid": cur.lastrowid}))
con.close()
