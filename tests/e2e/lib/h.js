// Visible-test harness for the INSTALLED ARWAAT app.
// Attaches to the real installed exe over CDP (--remote-debugging-port), so the
// installer's Electron fuses are left exactly as shipped. The banner and click
// dots are injected from here only - never from the app's production code.
const { chromium } = require('@playwright/test');
const { spawn, spawnSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULTS_DIR = path.join(ROOT, 'test-results');
const SHOTS = path.join(RESULTS_DIR, 'screenshots');
const VIDEOS = path.join(RESULTS_DIR, 'videos');
const RESULTS_JSON = path.join(RESULTS_DIR, 'results.json');
for (const d of [RESULTS_DIR, SHOTS, VIDEOS]) fs.mkdirSync(d, { recursive: true });

const EXE = process.env.ARWAAT_EXE || 'C:\\Program Files\\ARWAAT Stationery Systems\\ARWAAT Stationery Systems.exe';
const PORT = 9333;
const DATA_DIR = path.join(process.env.APPDATA, 'stationary-pos-app');
const DB_PATH = path.join(DATA_DIR, 'pos.db');

const SPEEDS = {
  slow: { slowMo: 400, keyDelay: 80, pause: 1500, steps: 14 },
  normal: { slowMo: 150, keyDelay: 25, pause: 500, steps: 6 },
  fast: { slowMo: 0, keyDelay: 0, pause: 0, steps: 1 },
};
const SPEED_NAME = SPEEDS[process.env.TEST_SPEED] ? process.env.TEST_SPEED : 'fast';
const S = SPEEDS[SPEED_NAME];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setDialogFile(filePath) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, '.test-dialog-path'), String(filePath || ''), 'utf8');
}

function restoreCleanMaster() {
  const master = path.join(ROOT, 'test-backups', 'CLEAN-MASTER.db');
  if (!fs.existsSync(master)) throw new Error('CLEAN-MASTER.db not found at ' + master);
  killApp();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const until = Date.now() + 8000;
  while (Date.now() < until) {
    try {
      for (const ext of ['-wal', '-shm']) {
        try { fs.rmSync(DB_PATH + ext, { force: true }); } catch {}
      }
      fs.copyFileSync(master, DB_PATH);
      break;
    } catch {
      /* file still locked, retry */
    }
  }
}

// ---------- results ----------
let current = { section: '', id: '', name: '', kind: 'V' };
function loadResults() { try { return JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf8')); } catch { return []; } }
function record(r) {
  const prev = loadResults();
  const before = prev.find((x) => x.id === r.id);
  const history = [...((before && before.history) || (before ? [before.status] : [])), r.status].slice(-8);
  const all = prev.filter((x) => !(x.id === r.id));
  all.push({ ...r, history, at: new Date().toISOString(), speed: SPEED_NAME });
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(all, null, 2));
}
function log(msg) { console.log(`[${current.id || '--'}] ${msg}`); }

// ---------- app launching ----------
async function cdpUp() {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); return r.ok; } catch { return false; }
}
// Dev mode (default): Electron from node_modules + the Vite dev server, so a code fix needs no rebuild
// (renderer edits hot-reload; main-process edits only need killApp + openApp). ARWAAT_INSTALLED=1 drives the installed exe instead.
const DEV = process.env.ARWAAT_INSTALLED !== '1';
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe');
const PROC_NAME = DEV ? 'electron.exe' : 'ARWAAT Stationery Systems.exe';
async function portUp(port) { try { const r = await fetch(`http://127.0.0.1:${port}/`); return r.status > 0; } catch { return false; } }
async function ensureVite() {
  if (!DEV || (await portUp(5173))) return;
  const v = spawn(process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js')], { cwd: ROOT, detached: true, stdio: 'ignore' });
  v.unref();
  for (let i = 0; i < 120 && !(await portUp(5173)); i++) await sleep(250);
}
function devEnv() { const e = { ...process.env, NODE_ENV: 'development', ARWAAT_TEST_MODE: '1' }; delete e.ELECTRON_RUN_AS_NODE; return e; }
function launchExe(mode) {
  const args = [`--mode=${mode}`, `--remote-debugging-port=${PORT}`];
  const child = DEV
    ? spawn(ELECTRON, ['.', ...args], { cwd: ROOT, detached: true, stdio: 'ignore', env: devEnv() })
    : spawn(EXE, args, { detached: true, stdio: 'ignore' });
  child.unref();
}
let browser = null;
async function connect() {
  if (browser && browser.isConnected()) return browser;
  browser = null;
  for (let i = 0; i < 80; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`, { slowMo: S.slowMo }); return browser; }
    catch { await sleep(250); }
  }
  throw new Error('Could not attach to the app');
}
function killApp() {
  spawnSync('taskkill', ['/F', '/IM', PROC_NAME], { stdio: 'ignore' });
  browser = null;
}
function wipeData() {
  killApp();
  const until = Date.now() + 8000;
  while (Date.now() < until) { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); break; } catch { /* file still locked, retry */ } }
}
async function modeOf(page) { try { return await page.evaluate(() => window.api && window.api.app && window.api.app.mode); } catch { return null; } }
async function findPage(mode) {
  const b = await connect();
  for (const ctx of b.contexts()) for (const p of ctx.pages()) { if ((await modeOf(p)) === mode) return p; }
  return null;
}
// Opens (or finds) the window for a mode, exactly as the shortcut would.
async function openApp(mode, { fresh = false } = {}) {
  await ensureVite();
  if (fresh) {
    killApp();
    for (let i = 0; i < 40 && (await cdpUp()); i++) await sleep(150);
  }
  if (!(await cdpUp())) {
    launchExe(mode);
    for (let i = 0; i < 80 && !(await cdpUp()); i++) await sleep(200);
  }
  await connect();
  let page = await findPage(mode);
  if (!page) {
    launchExe(mode); // hands over to the running process (single-instance lock)
    for (let i = 0; i < 80 && !page; i++) { await sleep(200); page = await findPage(mode); }
  }
  if (!page) throw new Error(`No ${mode} window appeared`);
  await page.waitForLoadState('domcontentloaded');
  await bringFront(page);
  return new UI(page, mode);
}
async function bringFront(page, bounds) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: bounds || { windowState: 'maximized' } });
    await cdp.detach();
  } catch (e) { /* window sizing is cosmetic */ }
  await page.bringToFront();
}

// ---------- overlay injected by the test (banner + click dots) ----------
async function overlay(page, bannerText) {
  await page.evaluate((txt) => {
    let b = document.getElementById('__t_banner');
    if (!b) {
      b = document.createElement('div'); b.id = '__t_banner';
      b.style.cssText = 'position:fixed;top:6px;right:6px;z-index:2147483647;background:#111c;color:#fff;font:600 13px Segoe UI,Arial;padding:6px 12px;border-radius:8px;pointer-events:none;max-width:60vw;box-shadow:0 2px 8px #0006';
      document.body.appendChild(b);
    }
    if (txt !== undefined && txt !== null) b.textContent = txt;
    if (!window.__t_dot) {
      window.__t_dot = (x, y) => {
        const d = document.createElement('div');
        d.style.cssText = `position:fixed;left:${x - 9}px;top:${y - 9}px;width:18px;height:18px;border-radius:50%;background:#ff1744;opacity:.85;z-index:2147483647;pointer-events:none;transition:opacity .9s,transform .9s`;
        document.body.appendChild(d);
        requestAnimationFrame(() => { d.style.opacity = '0'; d.style.transform = 'scale(2.2)'; });
        setTimeout(() => d.remove(), 1000);
      };
    }
  }, bannerText).catch(() => {});
}

// ---------- the page wrapper: human-speed actions ----------
class UI {
  constructor(page, mode) { this.page = page; this.mode = mode; this.errors = []; this._wire(); }
  _wire() {
    this.page.on('pageerror', (e) => this.errors.push('pageerror: ' + e.message));
    this.page.on('console', (m) => { if (m.type() === 'error') this.errors.push('console: ' + m.text()); });
  }
  loc(t) { return typeof t === 'string' ? this.page.locator(t) : t; }
  async banner(text) { await overlay(this.page, text); }
  async pause(ms) { const t = ms === undefined ? S.pause : ms; if (t) await sleep(t); }
  async click(target, label) {
    const l = this.loc(target).first();
    await l.waitFor({ state: 'visible', timeout: 15000 });
    await l.scrollIntoViewIfNeeded();
    const box = await l.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await overlay(this.page);
    await this.page.mouse.move(x, y, { steps: S.steps });
    await this.page.evaluate(([a, b]) => window.__t_dot && window.__t_dot(a, b), [x, y]).catch(() => {});
    await this.page.mouse.click(x, y);
    if (label) log(`click ${label}`);
  }
  async type(target, text, label) {
    const l = this.loc(target).first();
    await this.click(l);
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    if (text !== '') await this.page.keyboard.type(String(text), { delay: S.keyDelay });
    if (label !== false) log(`typed ${label || JSON.stringify(text)}`);
  }
  async press(key) { await this.page.keyboard.press(key); }
  // keyboard-wedge scanner: fast typing into whatever is focused, then Enter
  async scan(code) { await this.page.keyboard.type(String(code), { delay: 4 }); await this.page.keyboard.press('Enter'); log(`scanned ${code}`); }
  text(t) { return this.page.getByText(t, { exact: false }).first(); }
  async see(t, timeout = 10000) { await this.text(t).waitFor({ state: 'visible', timeout }); }
  async hasText(t, timeout = 2500) { try { await this.text(t).waitFor({ state: 'visible', timeout }); return true; } catch { return false; } }
  async body() { return this.page.evaluate(() => document.body.innerText); }
  btn(name, opts) { return this.page.getByRole('button', { name, ...(opts || {}) }).first(); }
  async shot(name) { const p = path.join(SHOTS, `${name.replace(/[^\w.-]+/g, '_')}.png`); await this.page.screenshot({ path: p }).catch(() => {}); return p; }
  // invoke an IPC the way the page would (used only for B checks, never to fake a visible step)
  async ipc(area, method, ...args) { return this.page.evaluate(([a, m, ar]) => window.api[a][m](...ar), [area, method, args]); }
}

// ---------- check runner ----------
// check(section, id, name, kind, async fn(ui?) ) -> records PASS/FAIL
async function check(section, id, name, kind, fn, ui) {
  current = { section, id, name, kind };
  if (ui) await ui.banner(`${id}: ${name}`);
  log(`${name} ...`);
  let status = 'PASS', detail = '', shot = '';
  try { await fn(); }
  catch (e) {
    status = 'FAIL'; detail = String(e && e.message || e).split('\n').slice(0, 4).join(' | ');
    if (ui) shot = await ui.shot(`${id}-FAIL`);
  }
  log(`${status === 'PASS' ? 'PASS' : 'FAIL -> ' + detail}`);
  record({ section, id, name, kind, status, detail, screenshot: shot });
  if (ui && status === 'PASS') await ui.pause();
  return status === 'PASS';
}
// Mark a check that cannot run because the feature does not exist / needs an owner decision.
function note(section, id, name, kind, status, detail) {
  current = { section, id, name, kind };
  console.log(`[${id}] ${status}: ${name} - ${detail}`);
  record({ section, id, name, kind, status, detail, screenshot: '' });
}
function expectEq(actual, expected, what) {
  if (typeof expected === 'number' && typeof actual === 'number' ? Math.abs(actual - expected) > 0.005 : actual !== expected) {
    throw new Error(`${what}: expected ${expected}, got ${actual}`);
  }
}

// ---------- DB reads (read-only, through python's sqlite3) ----------
function q(sql, params = []) {
  const out = execFileSync('python', ['-I', path.join(__dirname, '..', 'tools', 'q.py'), DB_PATH, sql, JSON.stringify(params)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}
function execSql(sql, params = []) {
  const out = execFileSync('python', ['-I', path.join(__dirname, '..', 'tools', 'w.py'), DB_PATH, sql, JSON.stringify(params)], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

// ---------- screen recording (real screen, so the video is what the owner saw) ----------
function startRecording(name) {
  if (SPEED_NAME === 'fast' && process.env.RECORD_VIDEO !== '1') {
    return { file: '', stop: async () => {} };
  }
  const file = path.join(VIDEOS, `${name.replace(/[^\w.-]+/g, '_')}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-f', 'gdigrab', '-framerate', '8', '-i', 'desktop', '-vf', 'scale=1280:-2', '-vcodec', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', file], { stdio: ['pipe', 'ignore', 'ignore'] });
  return { file, stop: () => new Promise((res) => { ff.on('close', res); try { ff.stdin.write('q'); } catch { res(); } setTimeout(res, 4000); }) };
}

module.exports = { PROC_NAME, DEV, ensureVite, wipeData, setDialogFile, restoreCleanMaster, ROOT, EXE, PORT, DATA_DIR, DB_PATH, S, SPEED_NAME, sleep, log, record, loadResults, openApp, killApp, bringFront, UI, check, note, expectEq, q, execSql, startRecording, cdpUp, connect, launchExe, RESULTS_DIR, SHOTS, VIDEOS };
