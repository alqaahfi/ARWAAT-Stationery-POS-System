const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const thermalReceipt = require('../printing/thermalReceipt');
const { printInvoice, printPaymentReceipt: printPaymentReceiptA4, printPurchaseReceipt } = require('../printing/printA4Invoice');
const { previewSale, previewPurchase } = require('../printing/previewDocument');

// Retail sales print silently to the thermal receipt printer; wholesale
// sales open the normal OS print dialog against an A4 invoice, so whoever's
// at the till can pick whichever printer has A4 paper loaded.
//
// This is only reached from the Print button of the renderer's print preview
// (PrintPreviewModal) — a sale is never sent to hardware automatically. The
// preview itself comes from `printing:preview-sale` below.
async function printSale(saleId, printType, showDues) {
  if (!saleId) return { success: false, reason: 'Missing sale id.' };

  if (printType === 'wholesale-a4') {
    return printInvoice({ saleId, showDues });
  }
  return thermalReceipt.print(saleId, { showDues });
}

// The preview's Save button — writes the already-rendered preview PDF
// (base64 from `printing:preview-sale`) wherever the user chooses.
async function savePdf(event, { pdfBase64, defaultName } = {}) {
  if (!pdfBase64) return { success: false, reason: 'Nothing to save.' };

  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showSaveDialog(win, {
    title: 'Save as PDF',
    defaultPath: `${defaultName || 'receipt'}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  });
  if (result.canceled || !result.filePath) return { success: false, canceled: true };

  try {
    fs.writeFileSync(result.filePath, Buffer.from(pdfBase64, 'base64'));
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not save the PDF.' };
  }
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
  ipcMain.handle('printing:preview-sale', (event, { saleId, printType, showDues } = {}) => previewSale({ saleId, printType, showDues }));
  ipcMain.handle('printing:preview-purchase', (event, { purchaseId } = {}) => previewPurchase({ purchaseId }));
  ipcMain.handle('printing:print-purchase', (event, { purchaseId } = {}) => (purchaseId ? printPurchaseReceipt({ purchaseId }) : { success: false, reason: 'Missing purchase id.' }));
  ipcMain.handle('printing:save-pdf', (event, data) => savePdf(event, data));

  ipcMain.handle('printers:list-installed', async (event) => {
    const printers = await event.sender.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName, isDefault: !!p.isDefault }));
  });

  ipcMain.handle('printers:test-print', () => thermalReceipt.testPrint());
}

module.exports = { registerPrintingIpc };
