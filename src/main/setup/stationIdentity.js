const crypto = require('crypto');
const { getDb } = require('../db/connection');

// This PC's identity on the shop network (sync peers, discovery). A random id
// created on first use and kept in settings('station_id') — nothing about the
// hardware, nothing to register. Upgraded installs inherit their old id from
// migration 035.
let cached = null;

function getStationId() {
  if (cached) return cached;
  const db = getDb();
  const row = db.prepare(`SELECT value FROM settings WHERE key = 'station_id'`).get();
  if (row && row.value) {
    cached = row.value;
    return cached;
  }
  cached = crypto.randomUUID();
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('station_id', ?)`).run(cached);
  return cached;
}

// Called after a backup is restored: the file may have come from another PC, and
// two PCs must never share an id. Next boot mints a fresh one.
function forgetStationId() {
  cached = null;
}

module.exports = { getStationId, forgetStationId };
