// In-app updates from the private GitHub repo (electron-updater).
//
//   - Packaged builds only. Never downloads on its own: a quiet check at start-up
//     and every 24 h, and only the Admin's "Update now" starts a download.
//   - Installing is guarded: nothing is being entered in any window, a verified full
//     backup is taken first, the pending update is recorded, then both windows close,
//     the database closes (WAL checkpoint) and the installer takes over.
//   - The read-only token comes from updateToken.js and is never logged or shown.
const { app } = require('electron');
const { getDb, closeDatabase } = require('../db/connection');
const { createPreUpdateBackup } = require('./preUpdateBackup');
const { writePending } = require('./pendingUpdate');
const entryBusy = require('./entryBusy');
const { getUpdateToken, scrub } = require('./updateToken');
const windows = require('../windows');

const OWNER = 'arwaheed';
const REPO = 'arwaat-pos-system';
const CONTACT_TEXT = "Updates can't be reached. Contact ARWAAT: 0319 2224504.";
const OFFLINE_TEXT = 'No internet connection. Connect this computer to the internet and try again.';
const DOWNLOAD_FAILED_TEXT = "The update didn't download. Check the internet connection and try again.";
const BUSY_TEXT = 'Finish or hold the bill in the Cashier window first.';
const FIRST_CHECK_DELAY_MS = 30 * 1000;
const CHECK_EVERY_MS = 24 * 60 * 60 * 1000;
const LAST_CHECK_KEY = 'update_last_check_at';
const UPDATED_NOTICE_KEY = 'updated_notice';

const supported = () => app.isPackaged;

const state = {
  status: 'idle', // idle | checking | uptodate | available | downloading | downloaded | installing | error
  lastCheckAt: null,
  available: null, // { version, notes, sizeBytes }
  progress: null, // { percent, transferred, total }
  error: null, // { kind: 'offline' | 'unreachable' | 'download' | 'failed', message }
};

let au = null;
let started = false;
let installing = false;
let checkTimer = null;
let intervalTimer = null;
let inFlight = null;

function getSetting(key) {
  try {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  } catch {
    return null;
  }
}

function setSetting(key, value) {
  try {
    getDb()
      .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, value === null ? null : String(value));
  } catch {
    // DB closed (shutting down) — nothing to record.
  }
}

// --- text helpers -----------------------------------------------------------

// Release notes arrive as HTML (latest.yml) or Markdown (the release body); the
// owner's text is shown as plain text.
function plainText(input) {
  if (!input) return '';
  let text = Array.isArray(input) ? input.map((n) => (n && n.note) || '').join('\n\n') : String(input);
  text = text
    .replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/\*\*|__|`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
}

function describeError(err, phase) {
  const raw = scrub(`${err && err.code ? `${err.code} ` : ''}${err && err.message ? err.message : err}`);
  const lower = raw.toLowerCase();
  if (/enotfound|econnrefused|econnreset|etimedout|eai_again|enetunreach|ehostunreach|err_internet_disconnected|err_network|err_name_not_resolved|err_connection|net::|timed out|socket hang up|getaddrinfo/.test(lower)) {
    return { kind: 'offline', message: OFFLINE_TEXT, detail: raw };
  }
  if (phase === 'download') return { kind: 'download', message: DOWNLOAD_FAILED_TEXT, detail: raw };
  if (/\b(401|403|404)\b|unauthorized|forbidden|bad credentials|err_updater_(latest_version|channel_file|asset)/.test(lower) || !getUpdateToken()) {
    return { kind: 'unreachable', message: CONTACT_TEXT, detail: raw };
  }
  return { kind: 'failed', message: "Couldn't check for updates. Please try again in a moment.", detail: raw };
}

// --- the electron-updater instance -------------------------------------------

function getUpdater() {
  if (au) return au;
  // Required lazily so the plain-Node rules harness (and dev runs) never load it.
  // eslint-disable-next-line global-require
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  // Nothing from the updater is logged except scrubbed errors.
  autoUpdater.logger = { info() {}, warn() {}, debug() {}, error: (m) => console.error('[updater]', scrub(m)) };
  autoUpdater.on('error', () => {}); // failures are handled where the promise rejects
  autoUpdater.on('download-progress', (p) => {
    state.progress = { percent: Math.round(p.percent || 0), transferred: p.transferred || 0, total: p.total || 0 };
  });
  const token = getUpdateToken();
  autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO, ...(token ? { token } : {}) });
  au = autoUpdater;
  return au;
}

// True when the read-only token can see the repository. A 404 for "latest release" with a
// working token only means nothing has been published yet — that is "up to date", not an error.
async function repoReadable() {
  const token = getUpdateToken();
  if (!token) return false;
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ARWAAT-POS-Updater' },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchReleaseNotes() {
  const token = getUpdateToken();
  if (!token) return '';
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'ARWAAT-POS-Updater' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return '';
    const body = await res.json();
    return plainText(body && body.body);
  } catch {
    return '';
  }
}

function sizeOf(info) {
  const files = (info && info.files) || [];
  const exe = files.find((f) => /\.exe$/i.test(f.url || '')) || files[0];
  return exe && Number(exe.size) > 0 ? Number(exe.size) : null;
}

// --- public API --------------------------------------------------------------

function getState() {
  return {
    success: true,
    supported: supported(),
    currentVersion: app.getVersion(),
    status: supported() ? state.status : 'dev',
    lastCheckAt: state.lastCheckAt || getSetting(LAST_CHECK_KEY),
    available: state.available,
    progress: state.progress,
    error: state.error,
    message: supported() ? null : 'Updates only work in the installed app.',
  };
}

async function checkForUpdates() {
  if (!supported()) return getState();
  if (installing || ['downloading', 'downloaded'].includes(state.status)) return getState();
  if (inFlight) return inFlight;

  inFlight = (async () => {
    state.status = 'checking';
    state.error = null;
    try {
      if (!getUpdateToken()) throw Object.assign(new Error('no update token in this build'), { code: 'ERR_NO_TOKEN' });
      const result = await getUpdater().checkForUpdates();
      state.lastCheckAt = new Date().toISOString();
      setSetting(LAST_CHECK_KEY, state.lastCheckAt);
      const info = result && result.updateInfo;
      if (!result || result.isUpdateAvailable === false || !info) {
        state.status = 'uptodate';
        state.available = null;
      } else {
        const notes = (await fetchReleaseNotes()) || plainText(info.releaseNotes);
        state.available = { version: info.version, notes, sizeBytes: sizeOf(info) };
        state.status = 'available';
      }
    } catch (err) {
      const described = describeError(err, 'check');
      if (described.kind === 'unreachable' && /404|latest_version_not_found/i.test(described.detail) && (await repoReadable())) {
        state.lastCheckAt = new Date().toISOString();
        setSetting(LAST_CHECK_KEY, state.lastCheckAt);
        state.status = 'uptodate';
        state.available = null;
      } else {
        state.error = described;
        state.status = 'error';
        state.available = null;
      }
    }
    return getState();
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function downloadUpdate() {
  if (!supported()) return getState();
  if (state.status === 'downloading' || state.status === 'downloaded') return getState();
  if (state.status !== 'available') await checkForUpdates();
  if (state.status !== 'available') return getState();
  state.status = 'downloading';
  state.progress = { percent: 0, transferred: 0, total: state.available ? state.available.sizeBytes || 0 : 0 };
  state.error = null;
  try {
    await getUpdater().downloadUpdate();
    state.progress = { ...state.progress, percent: 100 };
    state.status = 'downloaded';
  } catch (err) {
    state.error = describeError(err, 'download');
    state.status = 'available'; // the Admin can retry
    state.progress = null;
  }
  return getState();
}

function isInstalling() {
  return installing;
}

// "Update now" after the download: guard, back up, record, close, install.
async function installNow() {
  if (!supported()) return { success: false, reason: 'Updates only work in the installed app.' };
  if (installing) return { success: false, reason: 'The update is already being installed.' };
  if (state.status !== 'downloaded' || !state.available) return { success: false, reason: 'Download the update first.' };
  if (entryBusy.isAnyBusy()) return { success: false, code: 'busy', reason: BUSY_TEXT };

  installing = true; // also keeps the "last window closed" handler from quitting early
  const from = app.getVersion();
  const to = state.available.version;
  try {
    const db = getDb();
    const autoFolderRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_backup_folder'").get();
    const backup = await createPreUpdateBackup(db, from, { autoFolder: autoFolderRow && autoFolderRow.value });
    if (!backup.success) {
      installing = false;
      return { success: false, code: 'backup', reason: `The update was stopped because a safety copy of your data could not be made. ${backup.reason} Nothing was changed.` };
    }
    // A bill may have been started while the backup ran.
    if (entryBusy.isAnyBusy()) {
      installing = false;
      return { success: false, code: 'busy', reason: BUSY_TEXT };
    }

    writePending({ from, to, backupPath: backup.file, at: new Date().toISOString(), windows: windows.getOpenModes() }, db);
    state.status = 'installing';

    await windows.closeAllAppWindows();
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // closing the database checkpoints as well
    }
    require('../sync/syncEngine').stopSyncTimers();
    require('../sync/discovery').stopDiscovery();
    require('../sync/syncServer').stopSyncServer();
    require('../backup/autoBackup').stopAutoBackup();
    closeDatabase();

    getUpdater().quitAndInstall(true, true); // silent, and start the app again afterwards
    // If the installer could not take over, don't leave the shop without an app.
    setTimeout(() => {
      installing = false;
      windows.relaunchApp('admin');
    }, 30000).unref();
    return { success: true };
  } catch (err) {
    installing = false;
    state.status = 'downloaded';
    return { success: false, reason: `The update could not be installed: ${scrub(err && err.message ? err.message : err)}` };
  }
}

// One-time "Updated to version X" notice for Admin Home.
function consumeUpdatedNotice() {
  const version = getSetting(UPDATED_NOTICE_KEY);
  if (version) setSetting(UPDATED_NOTICE_KEY, null);
  return { success: true, version: version || null };
}

function noteUpdated(version) {
  setSetting(UPDATED_NOTICE_KEY, version);
}

function start() {
  if (started) return;
  started = true;
  state.lastCheckAt = getSetting(LAST_CHECK_KEY);
  if (!supported()) return;
  checkTimer = setTimeout(() => checkForUpdates().catch(() => {}), FIRST_CHECK_DELAY_MS);
  intervalTimer = setInterval(() => checkForUpdates().catch(() => {}), CHECK_EVERY_MS);
}

function stop() {
  clearTimeout(checkTimer);
  clearInterval(intervalTimer);
}

// _state is exposed for the rules checks only.
module.exports = { _state: state, start, stop, getState, checkForUpdates, downloadUpdate, installNow, isInstalling, consumeUpdatedNotice, noteUpdated, plainText, describeError };
