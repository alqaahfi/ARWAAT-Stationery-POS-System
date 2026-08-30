const { ipcMain } = require('electron');
const licenseManager = require('../license/licenseManager');

function registerAuthIpc() {
  ipcMain.handle('license:get-machine-id', () => licenseManager.getMachineId());
  ipcMain.handle('license:get-status', () => licenseManager.getActivationStatus());
  ipcMain.handle('license:activate-admin', (event, { licenseKey, shopName, stationCode }) =>
    licenseManager.activateAdmin(licenseKey, shopName, stationCode)
  );
  ipcMain.handle('license:activate-cashier', (event, { adminHost, stationCode }) =>
    licenseManager.activateCashier(adminHost, stationCode)
  );
}

module.exports = { registerAuthIpc };