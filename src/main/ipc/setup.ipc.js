const { ipcMain } = require('electron');
const setupManager = require('../setup/setupManager');
const { reloadOtherAppWindows } = require('../windows');

// Once Setup finishes in one window, the other app window (if open) reloads
// so it leaves its Setup screen too.
function afterSetup(event, result) {
  if (result && result.success) reloadOtherAppWindows(event.sender.id);
  return result;
}

function registerSetupIpc() {
  ipcMain.handle('setup:get-status', () => setupManager.getSetupStatus());
  ipcMain.handle('setup:create-admin', (event, payload) => afterSetup(event, setupManager.createAdminSetup(payload || {})));
  ipcMain.handle('setup:join-as-cashier', async (event, payload) => afterSetup(event, await setupManager.joinAsCashier(payload || {})));
}

module.exports = { registerSetupIpc };
