const { ipcMain } = require('electron');
const setupManager = require('../setup/setupManager');

function registerSetupIpc() {
  ipcMain.handle('setup:get-status', () => setupManager.getSetupStatus());
  ipcMain.handle('setup:create-admin', (event, payload) => setupManager.createAdminSetup(payload || {}));
  ipcMain.handle('setup:join-as-cashier', (event, payload) => setupManager.joinAsCashier(payload || {}));
}

module.exports = { registerSetupIpc };
