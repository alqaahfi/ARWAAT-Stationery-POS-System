// src/main/security/ipcGuard.js
//
// Who is calling, and may they? Installed once in index.js like the audit and
// sync-trigger middleware (patches ipcMain.handle before any register*Ipc()),
// so every channel is checked here and no handler re-implements it:
//
//   1. The call must come from the app's own page (dev server / dist/index.html).
//   2. Public channels (login, setup before it's done, app:*, Dev Panel unlock)
//      pass. Everything else needs a signed-in user in that window — or, for a
//      hidden print window, one of the few reads the print views make, checked
//      against the identity of the window that opened it.
//   3. Admin-only channels refuse a non-Admin; permission-gated channels check
//      the caller's user_permissions rows, the same keys the UI uses.
//
// Identity comes only from devpanel/sessionTracker.js (keyed by webContents id).
// Handlers that need it call getCaller(event) and ignore any user id the
// renderer sends. While a handler runs, currentCaller() returns the same
// identity so windows.js can hand it to a print window it creates.
const { AsyncLocalStorage } = require('async_hooks');
const path = require('path');
const { fileURLToPath } = require('url');
const { getDb } = require('../db/connection');
const sessions = require('../devpanel/sessionTracker');

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_ORIGIN = 'http://localhost:5173';
const APP_INDEX_PATH = path.resolve(__dirname, '../../renderer/dist/index.html').toLowerCase();

const SIGN_IN_AGAIN = { success: false, reason: 'Please sign in again.' };
const ADMIN_ONLY = { success: false, reason: 'This action is restricted to Admin accounts.' };
const NO_PERMISSION = { success: false, reason: "You don't have permission to do this. Ask your admin." };
const NOT_ALLOWED = { success: false, reason: 'This action is not allowed here.' };

// No signed-in user needed.
const PUBLIC_CHANNELS = new Set([
  'ping',
  'setup:get-status',
  'users:login',
  'users:validate-session',
  'users:logout',
  'devpanel:verify-password',
]);

// Public only while this PC has not been set up yet (the Setup screen).
const SETUP_CHANNELS = new Set(['setup:create-admin', 'setup:join-as-cashier', 'backup:validate-and-restore']);

// A counter PC that just joined has no accounts until its first sync, so its
// "Copying shop data" screen (CashierInitialSync) may run these signed out.
const FIRST_SYNC_CHANNELS = new Set(['sync:get-peers', 'sync:trigger-now']);

// The only reads the ?print=1 views make (pages/Print/*).
const PRINT_WINDOW_CHANNELS = new Set([
  'sales:get-receipt-data',
  'purchases:get-receipt-data',
  'ledgers:get-payment-by-id',
  'settings:get-all',
  'reports:get-report',
]);

const ADMIN_PREFIXES = [
  'returns:',
  'purchases:',
  'suppliers:',
  'dashboard:',
  'sessions:',
  'printers:',
  'backup:',
  'system:',
  'global:',
];

const ADMIN_CHANNELS = new Set([
  'ledgers:get-overview',
  'ledgers:get-payment-history',
  'ledgers:get-advances',
  'ledgers:get-aging-report',
  'ledgers:list-adjustments',
  'ledgers:create-adjustment',
  'printing:preview-purchase',
  'printing:print-purchase',
  'payments:create-supplier-payment',
  'payments:delete',
  'stock:add',
  'stock:remove',
  'stock:adjust',
  'stock:list-recount',
  'stock:resolve-recount',
  'approvals:list',
  'products:create',
  'products:update',
  'products:bulk-import',
  'products:set-active',
  'products:bulk-set-active',
  'products:bulk-set-category',
  'products:check-sku-unique',
  'products:check-barcode-unique',
  'products:transliterate-urdu',
  'products:get-dead-stock',
  'products:list-needs-review',
  'products:approve-review',
  'products:merge-review',
  'categories:create',
  'categories:update',
  'categories:delete',
  'customers:list',
  'customers:create',
  'customers:update',
  'customers:set-active',
  'customers:get-next-id',
  'customers:check-duplicate-phone',
  'users:list',
  'users:create-cashier',
  'users:update',
  'users:check-username-unique',
  'users:reset-password',
  'users:set-active',
  'permissions:get-for-user',
  'permissions:save-for-user',
  'settings:set',
  'settings:set-many',
  'letterheads:create',
  'letterheads:update',
  'letterheads:delete',
  'letterheads:pick-pdf',
  'sync:get-secret',
  'sync:get-log',
  'sync:get-peers',
  'sync:trigger-now',
  'sync:get-reconciliation-warnings',
  'reports:get-profit-loss',
  'reports:get-stock-report',
  'reports:get-customer-statements',
  'reports:get-supplier-statements',
  'reports:get-cashier-performance',
  'reports:get-expense-report',
]);

// Same permission keys the cashier Menu / navConfig use (admin has them all).
const PERMISSION_CHANNELS = {
  'sales:create': 'make_sale',
  'sales:update': 'make_sale',
  'sales:void': 'make_sale',
  'sales:list-recent': 'make_sale',
  'sales:get-for-edit': 'make_sale',
  'payments:create-standalone': 'record_payment',
  'sales:list': 'view_sales_history',
  'sales:get-detail': 'view_sales_history',
  'reports:get-sales-report': 'view_reports',
  'products:list': 'view_products',
  'products:get-by-id': 'view_products',
  'products:get-low-stock': 'view_products',
  'stock:get-product-stats': 'view_products',
  'stock:get-movements': 'view_products',
  // Rule 11: Add missing items at the counter.
  'products:quick-add': 'add_missing_items',
  'products:find-similar': 'add_missing_items',
};

// reports:get-report / reports:export-pdf dispatch on reportType. Sales is the
// cashier's own Sales Report; the expenses PDF is the Expenses list's export.
// Every other report is Admin-only.
const REPORT_TYPE_PERMISSION = { sales: 'view_reports', expenses: 'manage_expenses' };

const callerContext = new AsyncLocalStorage();

function isAppUrl(url) {
  if (!url) return false;
  if (isDev && (url === DEV_SERVER_ORIGIN || url.startsWith(`${DEV_SERVER_ORIGIN}/`))) return true;
  if (!url.startsWith('file:')) return false;
  try {
    const clean = url.split(/[?#]/)[0];
    return path.resolve(fileURLToPath(clean)).toLowerCase() === APP_INDEX_PATH;
  } catch {
    return false;
  }
}

function isSetUp() {
  try {
    const row = getDb().prepare('SELECT role FROM station_config WHERE id = 1').get();
    if (!row) return false;
    if (row.role === 'cashier') return true;
    return getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get().n > 0;
  } catch {
    return true;
  }
}

function awaitingFirstSync() {
  try {
    const row = getDb().prepare('SELECT role FROM station_config WHERE id = 1').get();
    if (!row || row.role !== 'cashier') return false;
    return !getDb().prepare('SELECT 1 FROM sync_peer_state WHERE last_sync_success_at IS NOT NULL LIMIT 1').get();
  } catch {
    return false;
  }
}

// Still a live session? (revoked, expired or deactivated -> forget it). If the
// DB is closed mid-restore, the in-memory identity is trusted for that call.
function sessionStillValid(entry) {
  try {
    const row = getDb()
      .prepare(
        `SELECT s.expires_at, u.is_active FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.user_id = ? AND s.is_revoked = 0`
      )
      .get(entry.sessionToken, entry.userId);
    return !!row && !!row.is_active && new Date(row.expires_at) > new Date();
  } catch {
    return true;
  }
}

// { userId, role, sessionToken, isPrintWindow } for the window behind `event`,
// or null when nobody is signed in there.
function getCaller(event) {
  const id = event?.sender?.id;
  if (id === undefined) return null;
  const entry = sessions.getSession(id);
  if (!entry) return null;
  if (!sessionStillValid(entry)) {
    sessions.clearSession(id);
    return null;
  }
  return { ...entry };
}

// `payload` with each named field set to the caller's own user id, for handlers
// that read the acting user from their payload. Whatever the renderer sent in
// those fields is ignored.
function withCallerId(event, payload, ...fields) {
  const userId = getCaller(event)?.userId ?? null;
  const out = { ...(payload || {}) };
  for (const field of fields) out[field] = userId;
  return out;
}

function currentCaller() {
  return callerContext.getStore() || null;
}

function hasPermission(caller, key) {
  if (!caller) return false;
  if (caller.role === 'admin') return true;
  try {
    return !!getDb()
      .prepare('SELECT 1 FROM user_permissions WHERE user_id = ? AND permission_key = ?')
      .get(caller.userId, key);
  } catch {
    return false;
  }
}

function isAdminChannel(channel) {
  if (ADMIN_CHANNELS.has(channel)) return true;
  return ADMIN_PREFIXES.some((p) => channel.startsWith(p));
}

// null = allowed; otherwise the refusal to send back.
function checkRole(channel, caller, payload) {
  if (channel === 'reports:get-report' || channel === 'reports:export-pdf') {
    const key = REPORT_TYPE_PERMISSION[payload?.reportType];
    if (!key) return caller.role === 'admin' ? null : ADMIN_ONLY;
    return hasPermission(caller, key) ? null : NO_PERMISSION;
  }
  if (channel.startsWith('expenses:')) return hasPermission(caller, 'manage_expenses') ? null : NO_PERMISSION;
  if (isAdminChannel(channel)) return caller.role === 'admin' ? null : ADMIN_ONLY;
  const key = PERMISSION_CHANNELS[channel];
  if (key && !hasPermission(caller, key)) return NO_PERMISSION;
  return null;
}

function authorize(channel, event, payload) {
  if (!isAppUrl(event?.senderFrame?.url)) return { refusal: NOT_ALLOWED };

  if (PUBLIC_CHANNELS.has(channel) || channel.startsWith('app:')) return { caller: getCaller(event) };
  if (SETUP_CHANNELS.has(channel) && !isSetUp()) return { caller: null };
  if (FIRST_SYNC_CHANNELS.has(channel) && !getCaller(event) && awaitingFirstSync()) return { caller: null };

  if (channel.startsWith('devpanel:')) {
    // Read-only diagnostics behind their own password; works on every screen.
    return sessions.isDevUnlocked(event.sender.id) ? { caller: getCaller(event) } : { refusal: NOT_ALLOWED };
  }

  const caller = getCaller(event);
  if (!caller) return { refusal: SIGN_IN_AGAIN };
  if (caller.isPrintWindow && !PRINT_WINDOW_CHANNELS.has(channel)) return { refusal: NOT_ALLOWED };

  const refusal = checkRole(channel, caller, payload);
  return refusal ? { refusal } : { caller };
}

function installIpcGuard(ipcMain) {
  const originalHandle = ipcMain.handle.bind(ipcMain);

  ipcMain.handle = function guardedHandle(channel, listener) {
    return originalHandle(channel, (event, ...args) => {
      const { refusal, caller } = authorize(channel, event, args[0]);
      if (refusal) return refusal;
      return callerContext.run(caller || null, () => listener(event, ...args));
    });
  };
}

module.exports = { installIpcGuard, getCaller, withCallerId, currentCaller, hasPermission, isAppUrl };
