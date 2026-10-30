// src/main/windows.js
//
// Every BrowserWindow the app opens is made here.
//
//   App windows — one per mode, at most one each: 'admin' and 'cashier'. Both
//   live in this one process (one DB, one sync server), each with its own
//   persistent session partition so localStorage (session token, lock state,
//   held bills, POS draft…) is completely separate. The mode is passed to the
//   renderer as a launch argument (preload exposes window.api.app.mode); main
//   keeps its own webContents.id -> mode map and never trusts the renderer's.
//
//   Hidden renderer windows — the ?print=1 views main loads for printing and
//   PDF export. They never sign in; they borrow the identity of the window whose
//   IPC call created them (ipcGuard's currentCaller) and may only make the reads
//   the print views need.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const sessions = require('./devpanel/sessionTracker');
const { currentCaller, isAppUrl } = require('./security/ipcGuard');

const isDev = process.env.NODE_ENV === 'development';
const DEV_URL = 'http://localhost:5173';
const INDEX_FILE = path.join(__dirname, '../renderer/dist/index.html');
const PRELOAD = path.join(__dirname, 'preload.js');

const MODES = {
  admin: { title: 'ARWAAT Stationery — Admin', label: 'ARWAAT Admin' },
  cashier: { title: 'ARWAAT Stationery — Cashier', label: 'ARWAAT Cashier' },
};

const appWindows = new Map(); // mode -> BrowserWindow
const modeByWebContents = new Map(); // webContents.id -> mode

function normalizeMode(value) {
  return value === 'cashier' ? 'cashier' : 'admin';
}

// `--mode=admin|cashier` from a command line (missing -> admin).
function modeFromArgv(argv) {
  const arg = (argv || []).find((a) => typeof a === 'string' && a.startsWith('--mode='));
  return normalizeMode(arg ? arg.slice('--mode='.length) : null);
}

function iconPath(mode) {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'icons', `${mode}.ico`)
    : path.join(__dirname, '../../build-resources', `${mode}.ico`);
}

// Hardened defaults for every window. The preload only uses contextBridge +
// ipcRenderer, so it runs fine sandboxed.
function secureWebPreferences(extra = {}) {
  return {
    preload: PRELOAD,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    devTools: !app.isPackaged,
    ...extra,
  };
}

function loadRenderer(win, search = '') {
  if (isDev) return win.loadURL(`${DEV_URL}/${search}`);
  return win.loadFile(INDEX_FILE, search ? { search } : undefined);
}

function getModeForWebContents(webContentsId) {
  return modeByWebContents.get(webContentsId) || null;
}

function openModeWindow(rawMode) {
  const mode = normalizeMode(rawMode);
  const existing = appWindows.get(mode);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    return existing;
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: MODES[mode].title,
    icon: iconPath(mode),
    webPreferences: secureWebPreferences({
      partition: `persist:${mode}`,
      additionalArguments: [`--arwaat-mode=${mode}`],
    }),
  });

  const webContentsId = win.webContents.id;
  appWindows.set(mode, win);
  modeByWebContents.set(webContentsId, mode);

  // Separate taskbar groups (and icons) for the two windows.
  if (process.platform === 'win32') {
    const relaunchArgs = app.isPackaged ? `--mode=${mode}` : `"${app.getAppPath()}" --mode=${mode}`;
    win.setAppDetails({
      appId: `com.arwaat.stationerysystems.${mode}`,
      appIconPath: iconPath(mode),
      relaunchCommand: `"${process.execPath}" ${relaunchArgs}`,
      relaunchDisplayName: MODES[mode].label,
    });
  }

  // Keep the fixed title (the page's <title> would replace it).
  win.on('page-title-updated', (e) => e.preventDefault());

  loadRenderer(win);
  if (isDev && process.env.ARWAAT_TEST_MODE !== '1') win.webContents.openDevTools();

  win.on('closed', () => {
    appWindows.delete(mode);
    modeByWebContents.delete(webContentsId);
    sessions.forgetWebContents(webContentsId);
  });
  return win;
}

function closeModeWindow(mode) {
  const win = appWindows.get(mode);
  if (win && !win.isDestroyed()) win.close();
}

// Restart the app (after a restore / reset) and reopen the given mode's window.
function relaunchApp(mode) {
  const args = process.argv.slice(1).filter((a) => !a.startsWith('--mode='));
  app.relaunch({ args: [...args, `--mode=${normalizeMode(mode)}`] });
  app.exit();
}

// After Setup finishes in one window, the other one re-reads its status.
function reloadOtherAppWindows(exceptWebContentsId) {
  for (const win of appWindows.values()) {
    if (!win.isDestroyed() && win.webContents.id !== exceptWebContentsId) win.webContents.reload();
  }
}

// Hidden window for a ?print=1 view, carrying the calling window's identity.
function createHiddenRendererWindow({ width, height, useContentSize } = {}) {
  const win = new BrowserWindow({
    show: false,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(useContentSize ? { useContentSize } : {}),
    webPreferences: secureWebPreferences(),
  });
  const webContentsId = win.webContents.id;
  sessions.linkPrintWindow(webContentsId, currentCaller());
  win.on('closed', () => sessions.forgetWebContents(webContentsId));
  return win;
}

// Hidden window that only shows a PDF file (Chromium's PDF viewer), no preload.
function createPdfWindow() {
  return new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, devTools: !app.isPackaged, plugins: true },
  });
}

// Applies to every webContents the app ever creates: no pop-ups, no
// navigating away from the app, no <webview>, no DevTools in packaged builds.
function installWebContentsHardening() {
  app.on('web-contents-created', (event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (e, url) => {
      if (!isAppUrl(url)) e.preventDefault();
    });
    contents.on('will-attach-webview', (e) => e.preventDefault());
    if (app.isPackaged) {
      contents.on('devtools-opened', () => contents.closeDevTools());
      contents.on('before-input-event', (e, input) => {
        const key = (input.key || '').toLowerCase();
        const devToolsKey = key === 'f12' || ((input.control || input.meta) && input.shift && ['i', 'j', 'c'].includes(key));
        if (devToolsKey) e.preventDefault();
      });
    }
  });
}

module.exports = {
  modeFromArgv,
  openModeWindow,
  closeModeWindow,
  reloadOtherAppWindows,
  relaunchApp,
  getModeForWebContents,
  createHiddenRendererWindow,
  createPdfWindow,
  loadRenderer,
  secureWebPreferences,
  installWebContentsHardening,
};
