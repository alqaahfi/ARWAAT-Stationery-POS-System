const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const Database = require('better-sqlite3');
const { getDb, getDbPath, closeDatabase, initDatabase } = require('../db/connection');
const { relaunchApp, getModeForWebContents } = require('../windows');
const autoBackup = require('../backup/autoBackup');

// Rule 16: choose the automatic backup folder (Settings -> Backup).
async function pickAutoBackupFolder() {
  const result = await dialog.showOpenDialog({
    title: 'Folder for automatic backups',
    defaultPath: autoBackup.getAutoBackupStatus().folder,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false, canceled: true };
  return autoBackup.setAutoBackupFolder(result.filePaths[0]);
}

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
    // The DB runs in WAL mode, so recent writes live in pos.db-wal until a
    // checkpoint. Copying only pos.db would silently leave them out; SQLite's
    // online backup writes one complete, consistent file.
    await getDb().backup(result.filePath);
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
    // Keep the data being replaced, in case the wrong backup was picked.
    try { fs.copyFileSync(dbPath, `${dbPath}.before-restore.bak`); } catch { /* nothing to keep */ }
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

  // A wrong, empty or damaged file must never replace the shop's data.
  if (!isValidBackupFile(result.filePaths[0])) {
    return { success: false, reason: "That file doesn't look like a valid ARWAAT POS backup. Nothing was changed." };
  }
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
    if (!(tables.includes('users') && (tables.includes('station_config') || tables.includes('license_activation')))) return false;
    return testDb.pragma('quick_check', { simple: true }) === 'ok';
  } catch {
    return false;
  } finally {
    if (testDb) testDb.close();
  }
}

// Used from Setup (before this PC is set up): validates the chosen file looks like a
// real backup of this app before swapping it in, then relaunches straight
// away — the restored file already carries its own station_config row
// and user accounts, so the app boots to the normal Login screen next time.
async function validateAndRestoreBackup(mode) {
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

  relaunchApp(mode);
  return { success: true };
}

function registerBackupIpc() {
  ipcMain.handle('backup:export', () => exportBackup());
  ipcMain.handle('backup:restore', () => restoreBackup());
  // Relaunches into the same window (Admin / Cashier) that asked.
  ipcMain.handle('backup:relaunch-app', (event) => relaunchApp(getModeForWebContents(event.sender.id)));
  ipcMain.handle('backup:validate-and-restore', (event) => validateAndRestoreBackup(getModeForWebContents(event.sender.id)));
  // Rule 16: automatic daily backup (all Admin-only through the backup: prefix).
  ipcMain.handle('backup:get-auto-status', () => autoBackup.getAutoBackupStatus());
  ipcMain.handle('backup:pick-auto-folder', () => pickAutoBackupFolder());
  ipcMain.handle('backup:set-auto-folder', (event, { folder } = {}) => autoBackup.setAutoBackupFolder(folder));
  ipcMain.handle('backup:run-auto-now', () => autoBackup.runAutoBackup({ force: true }));
  ipcMain.handle('backup:usb-reminder-done', () => autoBackup.markUsbReminderDone());
}

module.exports = { registerBackupIpc };
