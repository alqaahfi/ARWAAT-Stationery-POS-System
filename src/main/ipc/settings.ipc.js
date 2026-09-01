const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');

// Generic key/value handlers over the `settings` table — every Settings page
// reuses these instead of a one-off IPC handler per page. Values are always
// stored/read as text (the column is TEXT); callers coerce types themselves.

function getAll() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function set({ key, value }) {
  const db = getDb();
  if (!key) return { success: false, reason: 'Missing setting key.' };
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, value === undefined || value === null ? null : String(value));
  return { success: true };
}

function setMany(values) {
  const db = getDb();
  if (!values || typeof values !== 'object') return { success: false, reason: 'No values provided.' };

  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  const run = db.transaction((entries) => {
    for (const [key, value] of entries) {
      upsert.run(key, value === undefined || value === null ? null : String(value));
    }
  });
  run(Object.entries(values));

  return { success: true };
}

function registerSettingsIpc() {
  ipcMain.handle('settings:get-all', () => getAll());
  ipcMain.handle('settings:set', (event, payload) => set(payload || {}));
  ipcMain.handle('settings:set-many', (event, payload) => setMany(payload || {}));
}

module.exports = { registerSettingsIpc };
