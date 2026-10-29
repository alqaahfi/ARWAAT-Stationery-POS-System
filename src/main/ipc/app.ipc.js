const { ipcMain } = require('electron');
const { openModeWindow, closeModeWindow, getModeForWebContents } = require('../windows');

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
}

module.exports = { registerAppIpc };
