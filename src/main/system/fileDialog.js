const { app, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function isTestMode() {
  return !app.isPackaged && process.env.ARWAAT_TEST_MODE === '1';
}

function readNextTestPath() {
  if (!isTestMode()) return null;
  try {
    const file = path.join(app.getPath('userData'), '.test-dialog-path');
    if (fs.existsSync(file)) {
      const val = fs.readFileSync(file, 'utf8').trim();
      try { fs.unlinkSync(file); } catch { /* ignore */ }
      if (val) return val;
    }
  } catch { /* ignore */ }
  const envVal = (process.env.ARWAAT_TEST_FILE || '').trim();
  return envVal || null;
}

async function showSaveDialog(winOrOpts, maybeOpts) {
  const testPath = readNextTestPath();
  if (testPath) return { canceled: false, filePath: testPath };
  if (maybeOpts !== undefined) return dialog.showSaveDialog(winOrOpts, maybeOpts);
  return dialog.showSaveDialog(winOrOpts);
}

async function showOpenDialog(winOrOpts, maybeOpts) {
  const testPath = readNextTestPath();
  if (testPath) return { canceled: false, filePaths: [testPath] };
  if (maybeOpts !== undefined) return dialog.showOpenDialog(winOrOpts, maybeOpts);
  return dialog.showOpenDialog(winOrOpts);
}

module.exports = { isTestMode, showSaveDialog, showOpenDialog };
