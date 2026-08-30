const { BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';

// Reusable pattern: render the plain, print-only version of a report in a
// hidden window (same SPA, entered via a `?print=1` query string the renderer
// bootstrap checks for — see main.jsx), print it to a PDF buffer, then let
// the user save it. A4 invoices will reuse this same helper later.
async function exportReportToPdf({ reportType, filters }) {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const search =
    '?print=1&reportType=' + encodeURIComponent(reportType) + '&filters=' + encodeURIComponent(JSON.stringify(filters || {}));

  try {
    await new Promise((resolve, reject) => {
      win.webContents.once('did-finish-load', () => {
        // The print page fetches its own report data after mount — a short
        // settle delay stands in for a real "ready" signal, simple and good
        // enough for a report-sized dataset on a local SQLite query.
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

    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });

    const result = await dialog.showSaveDialog({
      title: 'Export PDF',
      defaultPath: `${reportType}.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };

    fs.writeFileSync(result.filePath, pdfBuffer);
    return { success: true, filePath: result.filePath };
  } catch (err) {
    return { success: false, reason: err.message || 'Could not export PDF.' };
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { exportReportToPdf };
