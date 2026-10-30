// Rule 16: automatic daily backup.
//
// Once a day — at the first start of the app that day, and at midnight while it
// keeps running — the database is copied with the same safe method as the
// manual backup (SQLite online backup, so recent WAL writes are included) into a
// folder (setting auto_backup_folder, default Documents\ARWAAT Backups). Files
// are named arwaat-auto-YYYY-MM-DD.db and kept for 30 days. The result (time,
// file, or the error) is kept in settings for Home and Settings -> Backup.
// Settings are per PC (not synced), so every PC backs up its own database.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { getDb } = require('../db/connection');

const KEEP_DAYS = 30;
const FILE_RE = /^arwaat-auto-(\d{4})-(\d{2})-(\d{2})\.db$/;
const USB_REMINDER_DAYS = 7;

let timer = null;
let running = null;

function getSetting(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value === null ? null : String(value));
}

function defaultFolder() {
  return path.join(app.getPath('documents'), 'ARWAAT Backups');
}

function backupFolder(db = getDb()) {
  return getSetting(db, 'auto_backup_folder') || defaultFolder();
}

function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Deletes automatic backups older than KEEP_DAYS (by the date in the file name).
function pruneOld(folder, now = new Date()) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - KEEP_DAYS);
  const removed = [];
  for (const name of fs.readdirSync(folder)) {
    const m = FILE_RE.exec(name);
    if (!m) continue;
    const fileDay = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (fileDay < cutoff) {
      try {
        fs.unlinkSync(path.join(folder, name));
        removed.push(name);
      } catch {
        // A file in use stays until next time.
      }
    }
  }
  return removed;
}

// force: run even when today's backup is already done (the "Back up now" button / tests).
async function runAutoBackup({ force = false, now = new Date() } = {}) {
  if (running) return running;
  running = (async () => {
    const db = getDb();
    const day = localDay(now);
    if (!force && getSetting(db, 'auto_backup_last_day') === day) return { success: true, skipped: true };
    const folder = backupFolder(db);
    try {
      fs.mkdirSync(folder, { recursive: true });
      const file = path.join(folder, `arwaat-auto-${day}.db`);
      const temp = `${file}.part`;
      await db.backup(temp);
      fs.renameSync(temp, file);
      const removed = pruneOld(folder, now);
      setSetting(db, 'auto_backup_last_at', new Date().toISOString());
      setSetting(db, 'auto_backup_last_day', day);
      setSetting(db, 'auto_backup_last_file', file);
      setSetting(db, 'auto_backup_last_error', null);
      setSetting(db, 'auto_backup_last_error_at', null);
      return { success: true, file, removed };
    } catch (err) {
      const reason = err && err.message ? err.message : 'Unknown error';
      try {
        setSetting(db, 'auto_backup_last_error', reason);
        setSetting(db, 'auto_backup_last_error_at', new Date().toISOString());
      } catch {
        // DB closed (e.g. during a restore) — nothing more to record.
      }
      return { success: false, reason: `The automatic backup failed: ${reason}` };
    }
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

function msUntilNextMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0);
  return next.getTime() - now.getTime();
}

// Called once at boot: today's backup if not done yet, then every midnight.
function startAutoBackup() {
  const tick = () => {
    runAutoBackup().catch(() => {});
    timer = setTimeout(tick, msUntilNextMidnight());
  };
  setTimeout(() => runAutoBackup().catch(() => {}), 5000);
  timer = setTimeout(tick, msUntilNextMidnight());
}

function stopAutoBackup() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function getAutoBackupStatus(db = getDb()) {
  const usbDoneAt = getSetting(db, 'usb_reminder_done_at');
  const usbDue = !usbDoneAt || Date.now() - Date.parse(usbDoneAt) > USB_REMINDER_DAYS * 24 * 3600 * 1000;
  return {
    success: true,
    folder: backupFolder(db),
    defaultFolder: defaultFolder(),
    lastAt: getSetting(db, 'auto_backup_last_at'),
    lastFile: getSetting(db, 'auto_backup_last_file'),
    lastError: getSetting(db, 'auto_backup_last_error'),
    lastErrorAt: getSetting(db, 'auto_backup_last_error_at'),
    keepDays: KEEP_DAYS,
    usbReminderDue: usbDue,
    usbReminderDoneAt: usbDoneAt,
  };
}

// The folder must exist (or be creatable) and be writable.
function setAutoBackupFolder(folder) {
  const db = getDb();
  const clean = String(folder || '').trim();
  if (!clean || !path.isAbsolute(clean)) return { success: false, reason: 'Choose a folder for the backups.' };
  try {
    fs.mkdirSync(clean, { recursive: true });
    const probe = path.join(clean, '.arwaat-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
  } catch {
    return { success: false, reason: "Backups can't be saved in that folder. Choose another one." };
  }
  setSetting(db, 'auto_backup_folder', clean);
  return { success: true, folder: clean };
}

function markUsbReminderDone() {
  setSetting(getDb(), 'usb_reminder_done_at', new Date().toISOString());
  return { success: true };
}

module.exports = {
  runAutoBackup,
  startAutoBackup,
  stopAutoBackup,
  getAutoBackupStatus,
  setAutoBackupFolder,
  markUsbReminderDone,
  pruneOld,
  KEEP_DAYS,
};
