// Full safety copy taken right before an update is installed:
//   userData/backups/pre-update/pre-update_<version>_<YYYY-MM-DD_HHmm>.db
// (<version> = the version the data was on when the copy was made.) Made with
// SQLite's online backup (same safe method as the manual and automatic backups),
// then opened read-only and checked. Newest 5 are kept; a copy also goes to the
// automatic-backup folder when one is set.
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');

const KEEP = 5;
const FILE_RE = /^pre-update_.+\.db$/;
const CORE_TABLES = ['_migrations', 'settings', 'users', 'products', 'product_variants', 'customers', 'sales', 'sale_items', 'payments'];

function preUpdateFolder() {
  return path.join(app.getPath('userData'), 'backups', 'pre-update');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// Read-only open, integrity_check, and the core tables are there.
function verifyBackup(file) {
  let test;
  try {
    test = new Database(file, { readonly: true, fileMustExist: true });
    if (test.pragma('integrity_check', { simple: true }) !== 'ok') return { ok: false, reason: 'the copy failed its integrity check' };
    const have = new Set(test.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    const missing = CORE_TABLES.filter((t) => !have.has(t));
    if (missing.length) return { ok: false, reason: `the copy is missing tables (${missing.join(', ')})` };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err && err.message ? err.message : 'the copy could not be opened' };
  } finally {
    if (test) test.close();
  }
}

function prune(folder) {
  const files = fs
    .readdirSync(folder)
    .filter((n) => FILE_RE.test(n))
    .map((n) => ({ n, t: fs.statSync(path.join(folder, n)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const f of files.slice(KEEP)) {
    try {
      fs.unlinkSync(path.join(folder, f.n));
    } catch {
      // in use — next time
    }
  }
}

async function createPreUpdateBackup(db, fromVersion, { autoFolder = null, now = new Date() } = {}) {
  const folder = preUpdateFolder();
  const name = `pre-update_${String(fromVersion).replace(/[^\w.-]/g, '_')}_${stamp(now)}.db`;
  const file = path.join(folder, name);
  const temp = `${file}.part`;
  try {
    fs.mkdirSync(folder, { recursive: true });
    await db.backup(temp);
    const check = verifyBackup(temp);
    if (!check.ok) {
      fs.rmSync(temp, { force: true });
      return { success: false, reason: `The backup could not be checked (${check.reason}).` };
    }
    fs.renameSync(temp, file);
  } catch (err) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // ignore
    }
    return { success: false, reason: `The backup could not be saved (${err && err.message ? err.message : 'unknown error'}).` };
  }

  prune(folder);
  if (autoFolder) {
    try {
      fs.mkdirSync(autoFolder, { recursive: true });
      fs.copyFileSync(file, path.join(autoFolder, name));
    } catch {
      // The verified copy in userData is the one that counts.
    }
  }
  return { success: true, file };
}

module.exports = { createPreUpdateBackup, verifyBackup, preUpdateFolder, KEEP };
