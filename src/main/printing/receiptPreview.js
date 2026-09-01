const { BrowserWindow } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';

// Dev-only stand-in for the silent thermal print path (see printing.ipc.js) —
// no physical receipt printer to test against yet, so this opens a real,
// visible window showing what the receipt would look like, with an "Export
// as Image" button (see the capture handler in printing.ipc.js) instead of
// printing it. Unlike the hidden windows used for PDF export / A4 printing,
// this one stays open and interactive.
async function showReceiptPreview({ saleId, showDues }) {
  const win = new BrowserWindow({
    width: 420,
    height: 760,
    title: 'Receipt Preview',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const search = `?print=1&printMode=receipt&saleId=${encodeURIComponent(saleId)}&showDues=${showDues ? '1' : '0'}`;

  if (isDev) {
    win.loadURL(`http://localhost:5173/${search}`);
  } else {
    win.loadFile(path.join(__dirname, '../../renderer/dist/index.html'), { search });
  }

  return { success: true };
}

module.exports = { showReceiptPreview };
