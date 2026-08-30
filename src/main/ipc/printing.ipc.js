const { ipcMain } = require('electron');

// Stub only — the real thermal/A4 print pipeline is a separate module. This
// exists so Sale.jsx has a stable call site to wire the real thing into later
// without changing anything on the caller's side.
function printSale(saleId, printType) {
  console.log(`[print stub] Would print sale #${saleId} as ${printType}`);
  return { success: true, stub: true };
}

function registerPrintingIpc() {
  ipcMain.handle('printing:print-sale', (event, { saleId, printType } = {}) => printSale(saleId, printType));
}

module.exports = { registerPrintingIpc };
