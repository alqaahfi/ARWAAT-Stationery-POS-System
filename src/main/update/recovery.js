// The screen shown INSTEAD of the app when the shop's data can't be opened safely at
// start-up (damaged file, an update step that failed, data from a newer version).
// Nothing else is registered or started in this mode — no IPC for the app, no sync, no
// windows — so the app can never run on a half-migrated database.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { readPending } = require('./pendingUpdate');
const { isValidBackupFile, copyBackupOverDatabase } = require('../backup/restoreFile');
const { getDbPath, closeDatabase } = require('../db/connection');

const CONTACT = 'Contact ARWAAT: 0319 2224504';

function buildInfo(problem) {
  const pending = readPending();
  const backupPath = pending && pending.backupPath && fs.existsSync(pending.backupPath) ? pending.backupPath : null;
  const base = { kind: problem.kind, detail: problem.detail || '', contact: CONTACT, canRestore: false };
  if (problem.kind === 'newer') {
    return { ...base, title: 'This data was made by a newer version of ARWAAT. Install the latest version.', lead: '' };
  }
  if (problem.kind === 'migration') {
    return {
      ...base,
      title: "The update couldn't finish. Your data is safe.",
      lead: 'The shop data was not changed by the step that failed.',
      canRestore: !!backupPath,
    };
  }
  return {
    ...base,
    title: "ARWAAT can't open the shop data safely.",
    lead: 'Nothing was changed. Do not enter new sales until this is fixed.',
    canRestore: !!backupPath,
  };
}

function pageHtml() {
  // Inline styles only (same rule as the app).
  return `<!doctype html><html><head><meta charset="utf-8"><title>ARWAAT Stationery Systems</title></head>
<body style="margin:0;font-family:'Segoe UI',Arial,sans-serif;background:#f2f2f7;color:#1c1c1e;">
<div style="max-width:560px;margin:48px auto;padding:0 24px;">
  <div style="font-weight:700;font-size:15px;letter-spacing:.04em;color:#6c6c70;">ARWAAT STATIONERY SYSTEMS</div>
  <div style="background:#fff;border-radius:16px;padding:28px;margin-top:16px;box-shadow:0 1px 3px rgba(0,0,0,.12);">
    <h1 id="title" style="font-size:22px;line-height:1.3;margin:0 0 12px 0;"></h1>
    <p id="lead" style="font-size:15px;line-height:1.5;margin:0 0 12px 0;color:#3a3a3c;"></p>
    <pre id="detail" style="display:none;white-space:pre-wrap;word-break:break-word;background:#f2f2f7;border-radius:10px;padding:12px;font-size:12.5px;line-height:1.45;color:#3a3a3c;margin:0 0 16px 0;font-family:Consolas,monospace;"></pre>
    <p id="msg" style="display:none;font-size:14px;line-height:1.45;margin:0 0 12px 0;"></p>
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;">
      <button id="restore" style="display:none;font-size:15px;font-weight:600;border:0;border-radius:10px;padding:12px 18px;background:#0a60ff;color:#fff;cursor:pointer;">Restore the backup from before the update</button>
      <button id="close" style="font-size:15px;font-weight:600;border:0;border-radius:10px;padding:12px 18px;background:#e5e5ea;color:#1c1c1e;cursor:pointer;">Close</button>
    </div>
    <p id="contact" style="font-size:14px;color:#6c6c70;margin:20px 0 0 0;"></p>
  </div>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  window.recovery.getInfo().then((info) => {
    $('title').textContent = info.title;
    $('lead').textContent = info.lead || '';
    $('lead').style.display = info.lead ? 'block' : 'none';
    if (info.detail) { $('detail').textContent = info.detail; $('detail').style.display = 'block'; }
    $('contact').textContent = info.contact;
    if (info.canRestore) $('restore').style.display = 'inline-block';
  });
  $('close').onclick = () => window.recovery.close();
  $('restore').onclick = async () => {
    $('restore').disabled = true;
    $('msg').style.display = 'block';
    $('msg').style.color = '#3a3a3c';
    $('msg').textContent = 'Restoring your data...';
    const res = await window.recovery.restore();
    if (!res || !res.success) {
      $('restore').disabled = false;
      $('msg').style.color = '#c0261b';
      $('msg').textContent = (res && res.reason) || 'The backup could not be restored.';
    }
  };
</script></body></html>`;
}

function showRecoveryWindow(problem) {
  const info = buildInfo(problem);
  const win = new BrowserWindow({
    width: 720,
    height: 560,
    title: 'ARWAAT Stationery Systems',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'recoveryPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  const own = (event) => event.sender.id === win.webContents.id;

  ipcMain.handle('recovery:get-info', (event) => (own(event) ? info : null));
  ipcMain.handle('recovery:close', (event) => {
    if (own(event)) app.quit();
  });
  ipcMain.handle('recovery:restore', async (event) => {
    if (!own(event)) return { success: false, reason: 'Not allowed.' };
    const pending = readPending();
    const backup = pending && pending.backupPath;
    if (!backup || !fs.existsSync(backup)) return { success: false, reason: 'The backup from before the update was not found.' };
    if (!isValidBackupFile(backup, { full: true })) {
      return { success: false, reason: "The backup from before the update didn't pass its check. Nothing was changed." };
    }
    try {
      closeDatabase();
      copyBackupOverDatabase(backup, getDbPath(), { keepStationId: true });
    } catch (err) {
      return { success: false, reason: `The backup could not be restored: ${err && err.message ? err.message : 'unknown error'}` };
    }
    // Start again: the app retries the update's steps on the restored data.
    require('../windows').relaunchApp('admin');
    return { success: true };
  });

  win.on('page-title-updated', (e) => e.preventDefault());
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pageHtml())}`);
  return win;
}

module.exports = { showRecoveryWindow, buildInfo };
