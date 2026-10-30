// Shared by Settings -> Restore, the Setup screen's restore and the update
// recovery screen: is this file a real ARWAAT backup, and put it in place of pos.db.
const fs = require('fs');
const Database = require('better-sqlite3');

// Opens the file read-only and checks it has the tables a real backup of this
// app would have, and that SQLite says it is not damaged.
function isValidBackupFile(filePath, { full = false } = {}) {
  let testDb;
  try {
    testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    // station_config is the current name; license_activation is what backups
    // taken before migration 035 call the same table.
    const tables = testDb
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('station_config', 'license_activation', 'users')`)
      .all()
      .map((r) => r.name);
    if (!(tables.includes('users') && (tables.includes('station_config') || tables.includes('license_activation')))) return false;
    return testDb.pragma(full ? 'integrity_check' : 'quick_check', { simple: true }) === 'ok';
  } catch {
    return false;
  } finally {
    if (testDb) testDb.close();
  }
}

// A backup may have come from another PC, and two PCs must never share a sync
// identity — drop the restored file's station id so the next boot mints a new one.
// (A backup from before migration 035 has no settings row to drop; harmless.)
function forgetRestoredStationId(dbPath) {
  let restored;
  try {
    restored = new Database(dbPath);
    restored.prepare(`DELETE FROM settings WHERE key = 'station_id'`).run();
  } catch {
    // Not fatal: worst case this PC keeps the backup's id.
  } finally {
    if (restored) restored.close();
  }
}

// Replaces pos.db with `srcPath`. The caller must have closed the database first.
// Keeps the data being replaced as pos.db.before-restore.bak. Throws on failure.
// keepStationId: the backup was made by THIS computer (pre-update), so its
// sync identity is still right.
function copyBackupOverDatabase(srcPath, dbPath, { keepStationId = false } = {}) {
  try {
    fs.copyFileSync(dbPath, `${dbPath}.before-restore.bak`);
  } catch {
    // nothing to keep
  }
  fs.copyFileSync(srcPath, dbPath);
  // Drop any leftover WAL/SHM sidecar files from the pre-restore database
  // so they don't get replayed against the newly-restored file.
  for (const suffix of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + suffix);
    } catch {
      // Fine if it doesn't exist.
    }
  }
  if (!keepStationId) forgetRestoredStationId(dbPath);
}

module.exports = { isValidBackupFile, copyBackupOverDatabase };
