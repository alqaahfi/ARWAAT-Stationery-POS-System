// The "update in progress" record: { from, to, backupPath, at, windows }.
// Kept in settings (key pending_update) AND in userData/pending-update.json —
// the file is what the recovery screen reads when the database itself can't be
// opened, and it survives restoring the pre-update backup (which has no record yet).
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const SETTING_KEY = 'pending_update';

function filePath() {
  return path.join(app.getPath('userData'), 'pending-update.json');
}

function readPending() {
  try {
    const rec = JSON.parse(fs.readFileSync(filePath(), 'utf8'));
    return rec && rec.to ? rec : null;
  } catch {
    return null;
  }
}

function writePending(record, db) {
  fs.writeFileSync(filePath(), JSON.stringify(record, null, 2), 'utf8');
  if (db) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      SETTING_KEY,
      JSON.stringify(record)
    );
  }
}

function clearPending(db) {
  try {
    fs.unlinkSync(filePath());
  } catch {
    // none
  }
  if (db) {
    try {
      db.prepare('DELETE FROM settings WHERE key = ?').run(SETTING_KEY);
    } catch {
      // settings table missing on a half-built database — nothing to clear
    }
  }
}

module.exports = { readPending, writePending, clearPending, SETTING_KEY };
