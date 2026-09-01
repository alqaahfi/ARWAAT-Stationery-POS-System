const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const thermalReceipt = require('../printing/thermalReceipt');
const { printInvoice, printPaymentReceipt: printPaymentReceiptA4 } = require('../printing/printA4Invoice');
const { showReceiptPreview } = require('../printing/receiptPreview');

const isDev = process.env.NODE_ENV === 'development';

// Retail sales print silently to the thermal receipt printer; wholesale
// sales open the normal OS print dialog against an A4 invoice, so whoever's
// at the till can pick whichever printer has A4 paper loaded.
//
// Dev-mode exception: with no physical thermal printer to test against yet,
// retail sales open a visible receipt preview window instead (see
// receiptPreview.js) — same shape of result either way, just no attempt to
// talk to real hardware. Swap this back to thermalReceipt.print(saleId)
// unconditionally once a printer is available to test with.
async function printSale(saleId, printType, showDues) {
  if (!saleId) return { success: false, reason: 'Missing sale id.' };

  if (printType === 'wholesale-a4') {
    return printInvoice({ saleId, showDues });
  }
  if (isDev) {
    return showReceiptPreview({ saleId, showDues });
  }
  return thermalReceipt.print(saleId, { showDues });
}

// Used by the receipt preview window's "Export as Image" button — captures
// just the receipt element (rect computed in the renderer from its own
// getBoundingClientRect(), so the toolbar around it isn't included) and
// saves it as a PNG wherever the user chooses.
async function captureReceiptImage(event, rect) {
  const image = rect ? await event.sender.capturePage(rect) : await event.sender.capturePage();

  const result = await dialog.showSaveDialog({
    title: 'Save Receipt Image',
    defaultPath: `receipt-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  fs.writeFileSync(result.filePath, image.toPNG());
  return { success: true, filePath: result.filePath };
}

// Admin chooses Thermal or A4 each time a payment is recorded (or reprinted)
// from within the Ledgers module — same two underlying functions either way,
// just routed by `format`.
async function printPaymentReceipt(paymentId, format) {
  if (!paymentId) return { success: false, reason: 'Missing payment id.' };
  if (format === 'a4') return printPaymentReceiptA4({ paymentId });
  return thermalReceipt.printPaymentReceipt(paymentId);
}

function registerPrintingIpc() {
  ipcMain.handle('printing:print-sale', (event, { saleId, printType, showDues } = {}) => printSale(saleId, printType, showDues));
  ipcMain.handle('printing:print-payment-receipt', (event, { paymentId, format } = {}) => printPaymentReceipt(paymentId, format));
  ipcMain.handle('printing:capture-receipt-image', (event, rect) => captureReceiptImage(event, rect));

  ipcMain.handle('printers:list-installed', async (event) => {
    const printers = await event.sender.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: !!p.isDefault }));
  });

  ipcMain.handle('printers:test-print', () => thermalReceipt.testPrint());
}

module.exports = { registerPrintingIpc };
