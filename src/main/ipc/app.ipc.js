const { ipcMain } = require('electron');
const { openModeWindow, closeModeWindow, getModeForWebContents } = require('../windows');
const { getDb } = require('../db/connection');
const { getClockStatus } = require('../system/clockCheck');
const entryBusy = require('../update/entryBusy');

// app:* channels are public (no sign-in): they only open/close the app's own
// Admin / Cashier windows.
function registerAppIpc() {
  // Opens (or focuses) the other app window; `closeThis` closes the calling one
  // — e.g. the Admin window on a counter PC hands over to the Cashier window.
  ipcMain.handle('app:open-window', (event, { mode, closeThis } = {}) => {
    const target = mode === 'cashier' ? 'cashier' : 'admin';
    const ownMode = getModeForWebContents(event.sender.id);
    openModeWindow(target);
    if (closeThis && ownMode && ownMode !== target) closeModeWindow(ownMode);
    return { success: true };
  });

  // A window reports that it is (or is no longer) in the middle of entering a sale, return
  // or purchase; the updater will not restart the app while any window is busy.
  ipcMain.handle('app:set-busy', (event, { key, busy } = {}) => {
    entryBusy.setBusy(event.sender.id, key, !!busy);
    return { success: true };
  });

  // Rule 15: wrong computer clock warning (public so it also shows on Setup / Login).
  ipcMain.handle('app:get-clock-status', () => {
    try {
      return getClockStatus(getDb());
    } catch {
      return { success: true, ok: true };
    }
  });
}

module.exports = { registerAppIpc };
