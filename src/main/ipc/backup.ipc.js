const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
const Database = require('better-sqlite3');
const { getDbPath, closeDatabase, initDatabase } = require('../db/connection');

async function exportBackup() {
  const dbPath = getDbPath();
  const dateStr = new Date().toISOString().slice(0, 10);

  const result = await dialog.showSaveDialog({
    title: 'Export Backup',
    defaultPath: `pos-backup-${dateStr}.db`,
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  try {
    fs.copyFileSync(dbPath, result.filePath);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not export backup.' };
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

// Electron can't safely swap out a locked SQLite file and reconnect without a
// restart — this closes the connection, replaces the file, and leaves the DB
// closed on success (the renderer prompts for a "Restart Now"). On failure
// the original connection is reopened so the app isn't left in a broken,
// DB-less state without a restart.
function swapDatabaseFile(srcPath) {
  const dbPath = getDbPath();
  try {
    closeDatabase();
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
    forgetRestoredStationId(dbPath);
    return { success: true };
  } catch (err) {
    initDatabase();
    return { success: false, reason: err.message || 'Could not restore backup.' };
  }
}

async function restoreBackup() {
  const result = await dialog.showOpenDialog({
    title: 'Restore from Backup',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  return swapDatabaseFile(result.filePaths[0]);
}

// Opens the selected file read-only and checks it has the tables a real
// backup of this app would have, before letting the Setup screen commit to
// overwriting the fresh (not yet set up) database with it.
function isValidBackupFile(filePath) {
  let testDb;
  try {
    testDb = new Database(filePath, { readonly: true, fileMustExist: true });
    // station_config is the current name; license_activation is what backups
    // taken before migration 035 call the same table.
    const tables = testDb
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('station_config', 'license_activation', 'users')`)
      .all()
      .map((r) => r.name);
    return tables.includes('users') && (tables.includes('station_config') || tables.includes('license_activation'));
  } catch {
    return false;
  } finally {
    if (testDb) testDb.close();
  }
}

function relaunchApp() {
  app.relaunch();
  app.exit();
}

// Used from Setup (before this PC is set up): validates the chosen file looks like a
// real backup of this app before swapping it in, then relaunches straight
// away — the restored file already carries its own station_config row
// and user accounts, so the app boots to the normal Login screen next time.
async function validateAndRestoreBackup() {
  const result = await dialog.showOpenDialog({
    title: 'Restore from Backup',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  const src = result.filePaths[0];
  if (!isValidBackupFile(src)) {
    return { success: false, reason: "That file doesn't look like a valid ARWAAT POS backup." };
  }

  const swapResult = swapDatabaseFile(src);
  if (!swapResult.success) return swapResult;

  relaunchApp();
  return { success: true };
}

function registerBackupIpc() {
  ipcMain.handle('backup:export', () => exportBackup());
  ipcMain.handle('backup:restore', () => restoreBackup());
  ipcMain.handle('backup:relaunch-app', () => relaunchApp());
  ipcMain.handle('backup:validate-and-restore', () => validateAndRestoreBackup());
}

module.exports = { registerBackupIpc };
