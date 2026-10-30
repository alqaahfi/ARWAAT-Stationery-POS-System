const { ipcMain } = require('electron');
const updater = require('../update/updater');

// updates:* is Admin-only (ipcGuard's ADMIN_PREFIXES) — the Cashier window has no update controls.
function registerUpdatesIpc() {
  ipcMain.handle('updates:get-state', () => updater.getState());
  ipcMain.handle('updates:check', () => updater.checkForUpdates());
  ipcMain.handle('updates:download', () => updater.downloadUpdate());
  ipcMain.handle('updates:install', () => updater.installNow());
  ipcMain.handle('updates:consume-updated-notice', () => updater.consumeUpdatedNotice());
}

module.exports = { registerUpdatesIpc };
