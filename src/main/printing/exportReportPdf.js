const fs = require('fs');
const { createHiddenRendererWindow, loadRenderer } = require('../windows');
const { showSaveDialog } = require('../system/fileDialog');

// Reusable pattern: render the plain, print-only version of a report in a
// hidden window (same SPA, entered via a `?print=1` query string the renderer
// bootstrap checks for — see main.jsx), print it to a PDF buffer, then let
// the user save it. A4 invoices will reuse this same helper later.
async function exportReportToPdf({ reportType, filters }) {
  // Carries the signed-in caller's identity, so the print view's report read
  // is checked (and a cashier's Sales Report locked) exactly as on screen.
  const win = createHiddenRendererWindow();

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

      loadRenderer(win, search);
    });

    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });

    const result = await showSaveDialog({
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
