const { ipcMain, app, dialog } = require('electron');
const fs = require('fs');
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

// Electron can't safely swap out a locked SQLite file and reconnect without a
// restart — this closes the connection, replaces the file, and leaves the DB
// closed on success (the renderer prompts for a "Restart Now"). On failure
// the original connection is reopened so the app isn't left in a broken,
// DB-less state without a restart.
async function restoreBackup() {
  const result = await dialog.showOpenDialog({
    title: 'Restore from Backup',
    filters: [{ name: 'SQLite Database', extensions: ['db'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return { success: false, canceled: true };

  const src = result.filePaths[0];
  const dbPath = getDbPath();

  try {
    closeDatabase();
    fs.copyFileSync(src, dbPath);
    // Drop any leftover WAL/SHM sidecar files from the pre-restore database
    // so they don't get replayed against the newly-restored file.
    for (const suffix of ['-wal', '-shm']) {
      try {
        fs.unlinkSync(dbPath + suffix);
      } catch {
        // Fine if it doesn't exist.
      }
    }
    return { success: true };
  } catch (err) {
    initDatabase();
    return { success: false, reason: err.message || 'Could not restore backup.' };
  }
}

function relaunchApp() {
  app.relaunch();
  app.exit();
}

function registerBackupIpc() {
  ipcMain.handle('backup:export', () => exportBackup());
  ipcMain.handle('backup:restore', () => restoreBackup());
  ipcMain.handle('backup:relaunch-app', () => relaunchApp());
}

module.exports = { registerBackupIpc };
