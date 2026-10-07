const { BrowserWindow, app } = require('electron');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/connection');
const { buildReceiptData } = require('./receiptData');
const { buildPurchaseReceiptData } = require('./purchaseReceiptData');
const { buildMergedInvoicePdf } = require('./pdfInvoiceMerge');

const isDev = process.env.NODE_ENV === 'development';

function getSettingsMap() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function receiptsDir() {
  const dir = path.join(app.getPath('userData'), 'receipts');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// A4 invoices are always the admin's own uploaded PDF letterhead (an A4 page
// the admin designed and uploaded in Settings > Letterheads) with the sale's
// content — customer, items, totals — stamped onto it as real vector text
// (see pdfInvoiceMerge.js), not a separately rendered HTML page. The merged
// PDF is written to disk (kept, not a scratch temp file, so the on-screen
// confirm popup in Sale.jsx can embed this exact same file afterwards
// regardless of whether the physical print below succeeds) and then printed
// via Chromium's own built-in PDF viewer.
// Builds the letterhead-merged invoice PDF without printing it — shared by
// the print path below and the print preview (previewDocument.js). Returns
// { success: true, pdfBytes } or { success: true, fallback: true } when the
// sale has no letterhead (caller renders the HTML fallback instead).
async function buildInvoicePdf({ saleId, showDues }) {
  const data = buildReceiptData(saleId, { showDues });
  if (!data) return { success: false, reason: 'Sale not found.' };

  const { sale } = data;
  // No letterhead assigned to the customer AND no default letterhead exists
  // — fall back to a plain-text A4 invoice instead of failing outright, using
  // receipt_header_text as the header (see ReceiptContent.jsx / Step 3).
  if (!sale.letterhead_pdf_path) return { success: true, fallback: true, sale };
  if (!fs.existsSync(sale.letterhead_pdf_path)) {
    return { success: false, reason: 'The letterhead PDF file is missing — re-upload it in Settings > Letterheads.' };
  }

  try {
    const pdfBytes = await buildMergedInvoicePdf({
      templatePath: sale.letterhead_pdf_path,
      data,
      settings: getSettingsMap(),
      marginTopMm: sale.letterhead_margin_top_mm,
      marginBottomMm: sale.letterhead_margin_bottom_mm,
    });
    return { success: true, pdfBytes, sale };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the invoice PDF.' };
  }
}

// Same as buildInvoicePdf, for a supplier purchase: stamped on the supplier's
// letterhead (or the shop default); no letterhead at all -> HTML fallback.
async function buildPurchasePdf({ purchaseId }) {
  const data = buildPurchaseReceiptData(purchaseId);
  if (!data) return { success: false, reason: 'Purchase not found.' };

  const { sale } = data;
  if (!sale.letterhead_pdf_path) return { success: true, fallback: true, sale };
  if (!fs.existsSync(sale.letterhead_pdf_path)) {
    return { success: false, reason: 'The letterhead PDF file is missing — re-upload it in Settings > Letterheads.' };
  }
  try {
    const pdfBytes = await buildMergedInvoicePdf({
      templatePath: sale.letterhead_pdf_path,
      data,
      settings: getSettingsMap(),
      marginTopMm: sale.letterhead_margin_top_mm,
      marginBottomMm: sale.letterhead_margin_bottom_mm,
    });
    return { success: true, pdfBytes, sale };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the purchase receipt PDF.' };
  }
}

// Sends an already-built PDF to the OS print dialog through a hidden window.
async function printPdfFile(pdfPath) {
  const win = new BrowserWindow({ show: false, webPreferences: { plugins: true } });
  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 400));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load PDF (${errorCode})`));
      });
      win.loadFile(pdfPath);
    });
    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!win.isDestroyed()) win.destroy();
        resolve(success ? { success: true, pdfPath } : { success: false, reason: failureReason || 'Print was cancelled.', pdfPath });
      });
    });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    return { success: false, reason: err.message || 'Could not open the receipt for printing.', pdfPath };
  }
}

// Loads one of the renderer's ?print=1 views in a hidden window and prints it.
async function printHiddenView(search) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { preload: path.join(__dirname, '../preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 700));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load print view (${errorCode})`));
      });
      if (isDev) win.loadURL(`http://localhost:5173/${search}`);
      else win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { search });
    });
    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!win.isDestroyed()) win.destroy();
        resolve(success ? { success: true } : { success: false, reason: failureReason || 'Print was cancelled.' });
      });
    });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    return { success: false, reason: err.message || 'Could not open the receipt for printing.' };
  }
}

async function printPurchaseReceipt({ purchaseId }) {
  const built = await buildPurchasePdf({ purchaseId });
  if (!built.success) return built;
  if (built.fallback) return printHiddenView(`?print=1&printMode=purchase-fallback&purchaseId=${encodeURIComponent(purchaseId)}`);
  const pdfPath = path.join(receiptsDir(), `purchase_${built.sale.id}_${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, built.pdfBytes);
  return printPdfFile(pdfPath);
}

async function printInvoice({ saleId, showDues }) {
  const built = await buildInvoicePdf({ saleId, showDues });
  if (!built.success) return built;
  if (built.fallback) return printInvoiceFallback({ saleId, showDues });

  const { sale, pdfBytes } = built;
  const pdfPath = path.join(receiptsDir(), `invoice_${sale.id}_${Date.now()}.pdf`);
  fs.writeFileSync(pdfPath, pdfBytes);

  const win = new BrowserWindow({
    show: false,
    // Enables Chromium's built-in PDF viewer, which is what lets a plain
    // BrowserWindow load and print a .pdf file directly.
    webPreferences: { plugins: true },
  });

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 400));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load invoice PDF (${errorCode})`));
      });
      win.loadFile(pdfPath);
    });

    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!win.isDestroyed()) win.destroy();
        resolve(success ? { success: true, pdfPath } : { success: false, reason: failureReason || 'Print was cancelled.', pdfPath });
      });
    });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    return { success: false, reason: err.message || 'Could not open invoice for printing.', pdfPath };
  }
}

// The no-letterhead fallback — same hidden-window HTML-print pattern as
// printPaymentReceipt() below, just pointed at PrintInvoice.jsx instead.
async function printInvoiceFallback({ saleId, showDues }) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const search = `?print=1&printMode=invoice-fallback&saleId=${encodeURIComponent(saleId)}&showDues=${showDues ? '1' : '0'}`;

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 700));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load invoice fallback view (${errorCode})`));
      });

      if (isDev) {
        win.loadURL(`http://localhost:5173/${search}`);
      } else {
        win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { search });
      }
    });

    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!win.isDestroyed()) win.destroy();
        resolve(success ? { success: true } : { success: false, reason: failureReason || 'Print was cancelled.' });
      });
    });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    return { success: false, reason: err.message || 'Could not open invoice for printing.' };
  }
}

// Payment receipts (Ledgers module) are unrelated to sale invoices and stay
// on the original HTML-print path — same hidden-window pattern, just pointed
// at the payment-receipt print view instead of a merged PDF.
async function printPaymentReceipt({ paymentId }) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const search = `?print=1&printMode=payment-receipt&paymentId=${encodeURIComponent(paymentId)}`;

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => {
        setTimeout(resolve, 700);
      });
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load print view (${errorCode})`));
      });

      if (isDev) {
        win.loadURL(`http://localhost:5173/${search}`);
      } else {
        win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { search });
      }
    });

    return await new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!win.isDestroyed()) win.destroy();
        resolve(success ? { success: true } : { success: false, reason: failureReason || 'Print was cancelled.' });
      });
    });
  } catch (err) {
    if (!win.isDestroyed()) win.destroy();
    return { success: false, reason: err.message || 'Could not open payment receipt for printing.' };
  }
}

module.exports = { printInvoice, printPaymentReceipt, buildInvoicePdf, buildPurchasePdf, printPurchaseReceipt };
