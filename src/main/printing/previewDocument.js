const { getDb } = require('../db/connection');
const { buildInvoicePdf, buildPurchasePdf } = require('./printA4Invoice');
const { buildReceiptData } = require('./receiptData');
const { createHiddenRendererWindow, loadRenderer } = require('../windows');

const MM_TO_PX = 96 / 25.4;
// printToPDF takes a custom pageSize in inches (Electron 21+), not microns.
const MM_TO_INCHES = 1 / 25.4;

function thermalWidthMm() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'thermal_paper_width'").get();
  return row && row.value === '80mm' ? 80 : 58;
}

// Loads one of the renderer's `?print=1` views in a hidden window and turns it
// into PDF bytes. `widthMm` null = A4; a number = a thermal roll of that width,
// with the page height measured from the rendered content so the receipt is one
// continuous page (no cut-off, no blank A4 tail).
async function renderViewToPdf(search, widthMm) {
  const win = createHiddenRendererWindow({
    useContentSize: true,
    width: widthMm ? Math.round(widthMm * MM_TO_PX) : 794,
    height: 600,
  });

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 700));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load preview view (${errorCode})`));
      });
      loadRenderer(win, search);
    });

    let pageSize = 'A4';
    if (widthMm) {
      const heightPx = await win.webContents.executeJavaScript('document.getElementById("root").scrollHeight');
      const heightMm = Math.max(40, heightPx / MM_TO_PX + 4);
      pageSize = { width: widthMm * MM_TO_INCHES, height: heightMm * MM_TO_INCHES };
    }
    return await win.webContents.printToPDF({ pageSize, printBackground: true, margins: { marginType: 'none' } });
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

// Builds the exact document the user is about to print, as a PDF, without
// touching any printer. A4 = the letterhead-merged invoice (or the HTML
// fallback); thermal = the shared receipt view sized to the paper roll.
async function previewSale({ saleId, printType, showDues }) {
  if (!saleId) return { success: false, reason: 'Missing sale id.' };
  const dues = showDues ? '1' : '0';

  try {
    const rData = buildReceiptData(saleId, { showDues });
    const stampLines = rData ? rData.stampLines : [];
    if (printType === 'wholesale-a4') {
      const built = await buildInvoicePdf({ saleId, showDues });
      if (!built.success) return built;
      const bytes = built.fallback
        ? await renderViewToPdf(`?print=1&printMode=invoice-fallback&saleId=${encodeURIComponent(saleId)}&showDues=${dues}`, null)
        : built.pdfBytes;
      return { success: true, format: 'a4', pdfBase64: Buffer.from(bytes).toString('base64'), invoiceNo: built.sale.invoice_no, stampLines };
    }

    const widthMm = thermalWidthMm();
    const bytes = await renderViewToPdf(`?print=1&printMode=receipt&saleId=${encodeURIComponent(saleId)}&showDues=${dues}`, widthMm);
    return { success: true, format: 'thermal', widthMm, pdfBase64: Buffer.from(bytes).toString('base64'), stampLines };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the print preview.' };
  }
}

// Same preview for a supplier purchase: always A4 (letterhead or plain fallback).
async function previewPurchase({ purchaseId }) {
  if (!purchaseId) return { success: false, reason: 'Missing purchase id.' };
  try {
    const built = await buildPurchasePdf({ purchaseId });
    if (!built.success) return built;
    const bytes = built.fallback
      ? await renderViewToPdf(`?print=1&printMode=purchase-fallback&purchaseId=${encodeURIComponent(purchaseId)}`, null)
      : built.pdfBytes;
    return { success: true, format: 'a4', pdfBase64: Buffer.from(bytes).toString('base64'), invoiceNo: built.sale.invoice_no };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the print preview.' };
  }
}

module.exports = { previewSale, previewPurchase };
