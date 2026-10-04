// The id the next INSERT into `table` will receive. AUTOINCREMENT tables hand
// out max(ever used) + 1 (sqlite_sequence survives deletes); fall back to
// MAX(id) for any table without a sequence row yet.
const ALLOWED_TABLES = new Set(['customers', 'suppliers']);

function getNextId(db, table) {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`getNextId: unsupported table ${table}`);
  const seq = db.prepare('SELECT seq FROM sqlite_sequence WHERE name = ?').get(table);
  const max = db.prepare(`SELECT COALESCE(MAX(id), 0) AS m FROM ${table}`).get();
  return Math.max(seq ? seq.seq : 0, max.m) + 1;
}

module.exports = { getNextId };
