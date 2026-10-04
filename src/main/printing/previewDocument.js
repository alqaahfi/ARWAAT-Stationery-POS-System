const { BrowserWindow } = require('electron');
const path = require('path');
const { getDb } = require('../db/connection');
const { buildInvoicePdf } = require('./printA4Invoice');

const isDev = process.env.NODE_ENV === 'development';

const MM_TO_PX = 96 / 25.4;
const MM_TO_MICRONS = 1000;

function thermalWidthMm() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'thermal_paper_width'").get();
  return row && row.value === '80mm' ? 80 : 58;
}

// Loads one of the renderer's `?print=1` views in a hidden window and turns it
// into PDF bytes. `widthMm` null = A4; a number = a thermal roll of that width,
// with the page height measured from the rendered content so the receipt is one
// continuous page (no cut-off, no blank A4 tail).
async function renderViewToPdf(search, widthMm) {
  const win = new BrowserWindow({
    show: false,
    useContentSize: true,
    width: widthMm ? Math.round(widthMm * MM_TO_PX) : 794,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => setTimeout(resolve, 700));
      win.webContents.once('did-fail-load', (event, errorCode, errorDescription) => {
        reject(new Error(errorDescription || `Failed to load preview view (${errorCode})`));
      });
      if (isDev) {
        win.loadURL(`http://localhost:5173/${search}`);
      } else {
        win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { search });
      }
    });

    let pageSize = 'A4';
    if (widthMm) {
      const heightPx = await win.webContents.executeJavaScript('document.getElementById("root").scrollHeight');
      const heightMm = Math.max(40, heightPx / MM_TO_PX + 4);
      pageSize = { width: Math.round(widthMm * MM_TO_MICRONS), height: Math.round(heightMm * MM_TO_MICRONS) };
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
    if (printType === 'wholesale-a4') {
      const built = await buildInvoicePdf({ saleId, showDues });
      if (!built.success) return built;
      const bytes = built.fallback
        ? await renderViewToPdf(`?print=1&printMode=invoice-fallback&saleId=${encodeURIComponent(saleId)}&showDues=${dues}`, null)
        : built.pdfBytes;
      return { success: true, format: 'a4', pdfBase64: Buffer.from(bytes).toString('base64'), invoiceNo: built.sale.invoice_no };
    }

    const widthMm = thermalWidthMm();
    const bytes = await renderViewToPdf(`?print=1&printMode=receipt&saleId=${encodeURIComponent(saleId)}&showDues=${dues}`, widthMm);
    return { success: true, format: 'thermal', widthMm, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not build the print preview.' };
  }
}

module.exports = { previewSale };
