// Rules-check harness: runs the real main-process code (migrations, IPC
// handlers, the IPC guard, balanceEngine, reports...) against a throw-away
// SQLite file, with a tiny fake `electron` module. No windows, no Vite.
//
// Run with Electron's Node so better-sqlite3 / bcrypt match their build:
//   ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe tests/rules/run.js
const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');

process.env.NODE_ENV = 'development'; // the guard accepts the dev-server origin
const ROOT = path.resolve(__dirname, '../../..');
const MAIN = path.join(ROOT, 'src/main');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'arwaat-rules-'));

const handlers = new Map();
const electronMock = {
  app: {
    getPath: (name) => (name === 'documents' ? path.join(TMP, 'Documents') : path.join(TMP, 'userData')),
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    on() {},
    whenReady: () => Promise.resolve(),
    relaunch() {},
    exit() {},
    quit() {},
  },
  ipcMain: {
    handle(channel, fn) {
      handlers.set(channel, fn);
    },
    on() {},
    removeHandler(channel) {
      handlers.delete(channel);
    },
  },
  dialog: {
    showSaveDialog: async () => ({ canceled: true }),
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showMessageBox: async () => ({ response: 0 }),
  },
  BrowserWindow: class {
    static getAllWindows() {
      return [];
    }
    static fromWebContents() {
      return null;
    }
  },
  net: { fetch: async () => { throw new Error('offline in tests'); } },
  webContents: { fromId: () => null, getAllWebContents: () => [] },
  shell: {},
  Menu: {},
  nativeImage: {},
  session: {},
  screen: {},
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') return electronMock;
  return originalLoad.call(this, request, parent, isMain);
};

fs.mkdirSync(path.join(TMP, 'userData'), { recursive: true });

// Keep the output to PASS/FAIL lines (migrations log every file they apply).
const originalLog = console.log;
console.log = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('Applying migration')) return;
  originalLog(...args);
};

const m = (p) => require(path.join(MAIN, p));
const connection = m('db/connection');
const sessionTracker = m('devpanel/sessionTracker');
const { installIpcGuard } = m('security/ipcGuard');

connection.initDatabase();
installIpcGuard(electronMock.ipcMain);

const REGISTER = [
  ['ipc/users.ipc', 'registerUsersIpc'],
  ['ipc/dashboard.ipc', 'registerDashboardIpc'],
  ['ipc/categories.ipc', 'registerCategoriesIpc'],
  ['ipc/products.ipc', 'registerProductsIpc'],
  ['ipc/stock.ipc', 'registerStockIpc'],
  ['ipc/suppliers.ipc', 'registerSuppliersIpc'],
  ['ipc/customers.ipc', 'registerCustomersIpc'],
  ['ipc/ledgers.ipc', 'registerLedgersIpc'],
  ['ipc/sales.ipc', 'registerSalesIpc'],
  ['ipc/salesHistory.ipc', 'registerSalesHistoryIpc'],
  ['ipc/returns.ipc', 'registerReturnsIpc'],
  ['ipc/printing.ipc', 'registerPrintingIpc'],
  ['ipc/payments.ipc', 'registerPaymentsIpc'],
  ['ipc/reports.ipc', 'registerReportsIpc'],
  ['ipc/expenses.ipc', 'registerExpensesIpc'],
  ['ipc/purchases.ipc', 'registerPurchasesIpc'],
  ['ipc/settings.ipc', 'registerSettingsIpc'],
  ['ipc/backup.ipc', 'registerBackupIpc'],
  ['ipc/system.ipc', 'registerSystemIpc'],
  ['ipc/global.ipc', 'registerGlobalIpc'],
  ['ipc/app.ipc', 'registerAppIpc'],
];
for (const [file, fn] of REGISTER) {
  const mod = m(file);
  if (typeof mod[fn] === 'function') mod[fn]();
}
// Optional modules added by Stage 1 (registered only when present).
for (const [file, fn] of [
  ['ipc/approvals.ipc', 'registerApprovalsIpc'],
  ['ipc/sync.ipc', 'registerSyncIpc'],
]) {
  try {
    const mod = m(file);
    if (typeof mod[fn] === 'function') mod[fn]();
  } catch (err) {
    if (err.code !== 'MODULE_NOT_FOUND') throw err;
  }
}

const db = () => connection.getDb();

// ---------- identities (one fake window per user) ----------
const WC = { admin: 1, cashier: 2, cashier2: 3, nobody: 99 };
let users = {};

function signIn(who, userId, role) {
  const token = `tok-${who}-${userId}-${Date.now()}-${Math.random()}`;
  db()
    .prepare('INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)')
    .run(userId, token, new Date(Date.now() + 3600e3).toISOString());
  sessionTracker.setSession(WC[who], { userId, role, sessionToken: token });
}

async function invoke(channel, payload, as = 'admin') {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  const event = { sender: { id: WC[as] }, senderFrame: { url: 'http://localhost:5173/' } };
  return fn(event, payload);
}

const bcrypt = require('bcrypt');
const FAST_HASH = (pw) => bcrypt.hashSync(pw, 4);

// ---------- fresh database + baseline shop ----------
function freshDb() {
  connection.closeDatabase();
  const dbPath = connection.getDbPath();
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(dbPath + suffix); } catch { /* none */ }
  }
  connection.initDatabase();
  for (const id of Object.values(WC)) sessionTracker.forgetWebContents(id);
  const d = db();
  d.prepare("INSERT INTO station_config (id, shop_name, role, station_code, sync_secret) VALUES (1, 'Test Shop', 'admin', 'MAIN', 'secret')").run();
  const ins = d.prepare('INSERT INTO users (full_name, username, password_hash, role) VALUES (?, ?, ?, ?)');
  users = {
    admin: ins.run('Owner', 'admin', FAST_HASH('Admin@123'), 'admin').lastInsertRowid,
    cashier: ins.run('Cashier One', 'cashier1', FAST_HASH('Cash@123'), 'cashier').lastInsertRowid,
    cashier2: ins.run('Cashier Two', 'cashier2', FAST_HASH('Cash@123'), 'cashier').lastInsertRowid,
  };
  const grant = d.prepare('INSERT INTO user_permissions (user_id, permission_key, value) VALUES (?, ?, ?)');
  for (const who of ['cashier', 'cashier2']) {
    for (const key of ['make_sale', 'record_payment', 'view_sales_history', 'view_reports', 'view_products']) grant.run(users[who], key, null);
    grant.run(users[who], 'max_discount_percentage', '10');
  }
  try {
    grant.run(users.cashier, 'add_missing_items', null);
    grant.run(users.cashier2, 'add_missing_items', null);
  } catch { /* permission not known yet */ }
  signIn('admin', users.admin, 'admin');
  signIn('cashier', users.cashier, 'cashier');
  signIn('cashier2', users.cashier2, 'cashier');
  return users;
}

// A product with one Type and a Piece unit (+ optional Box), stock in pieces.
function addProduct({ name, retail = 100, wholesale = 90, cost = 60, stock = 50, barcode = null, box = null, netC1 = null }) {
  const d = db();
  const pid = d.prepare("INSERT INTO products (name, base_unit_name, min_stock_alert) VALUES (?, 'Piece', 5)").run(name).lastInsertRowid;
  const vid = d.prepare('INSERT INTO product_variants (product_id, variant_name, barcode, stock_qty) VALUES (?, ?, ?, ?)')
    .run(pid, 'Standard', barcode, stock).lastInsertRowid;
  const unit = d.prepare(
    `INSERT INTO product_units (product_id, unit_name, conversion_factor, retail_price, wholesale_price, cost_price, is_default_sale_unit, net_rate_c1)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const uid = unit.run(pid, 'Piece', 1, retail, wholesale, cost, box ? 0 : 1, netC1).lastInsertRowid;
  let boxId = null;
  if (box) boxId = unit.run(pid, 'Box', box.factor, box.retail, box.wholesale ?? box.retail, box.cost ?? cost * box.factor, 1, null).lastInsertRowid;
  if (stock) {
    d.prepare("INSERT INTO stock_movements (product_variant_id, movement_type, quantity, reference_type) VALUES (?, 'purchase', ?, 'initial_stock')").run(vid, stock);
  }
  return { productId: pid, variantId: vid, unitId: uid, boxUnitId: boxId };
}

function addCustomer({ name, type = 'retail', tier = null, opening = 0, creditLimit = 0, phone = null, mobile = null }) {
  return db()
    .prepare('INSERT INTO customers (name, customer_type, tier, opening_balance, credit_limit, phone, mobile) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(name, type, tier, opening, creditLimit, phone, mobile).lastInsertRowid;
}

function addSupplier({ name, opening = 0 }) {
  return db().prepare('INSERT INTO suppliers (name, opening_balance) VALUES (?, ?)').run(name, opening).lastInsertRowid;
}

// One cart line for sales:create.
function line(p, qty, price, { unitId, foc = 0 } = {}) {
  return {
    productVariantId: p.variantId,
    productUnitId: unitId || p.unitId,
    quantity: qty,
    focQuantity: foc,
    unitPrice: price,
    lineTotal: Math.round(qty * price * 100) / 100,
    discountAmount: 0,
  };
}

function stockOf(variantId) {
  return db().prepare('SELECT stock_qty FROM product_variants WHERE id = ?').get(variantId).stock_qty;
}

function movementSum(variantId) {
  return db().prepare('SELECT COALESCE(SUM(quantity), 0) AS s FROM stock_movements WHERE product_variant_id = ?').get(variantId).s;
}

// Moves a sale's timestamp into the past (minutes) — for the 10-minute rules.
function ageSale(saleId, minutes) {
  db().prepare(`UPDATE sales SET created_at = datetime('now', ?) WHERE id = ?`).run(`-${minutes} minutes`, saleId);
}

function cleanup() {
  try { connection.closeDatabase(); } catch { /* closed */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
}

module.exports = {
  ROOT,
  MAIN,
  TMP,
  m,
  db,
  invoke,
  handlers,
  freshDb,
  addProduct,
  addCustomer,
  addSupplier,
  line,
  stockOf,
  movementSum,
  ageSale,
  signIn,
  get users() {
    return users;
  },
  electronMock,
  cleanup,
};
