const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDatabase } = require('./db/connection');
const { registerAuthIpc } = require('./ipc/auth.ipc');
const { registerUsersIpc, seedDummyCashier } = require('./ipc/users.ipc');
const { registerDashboardIpc } = require('./ipc/dashboard.ipc');
const { registerCategoriesIpc } = require('./ipc/categories.ipc');
const { registerProductsIpc } = require('./ipc/products.ipc');
const { registerStockIpc } = require('./ipc/stock.ipc');
const { registerSuppliersIpc } = require('./ipc/suppliers.ipc');
const { registerCustomersIpc } = require('./ipc/customers.ipc');
const { registerLedgersIpc } = require('./ipc/ledgers.ipc');
const { registerLetterheadsIpc } = require('./ipc/letterheads.ipc');
const { registerSalesIpc } = require('./ipc/sales.ipc');
const { registerPrintingIpc } = require('./ipc/printing.ipc');
const { registerPaymentsIpc } = require('./ipc/payments.ipc');
const { registerReportsIpc } = require('./ipc/reports.ipc');
const { registerExpensesIpc } = require('./ipc/expenses.ipc');
const { generateDueRecurringExpenses } = require('./expenses/recurringExpenses');
const { registerSyncIpc } = require('./ipc/sync.ipc');
const { registerPurchasesIpc } = require('./ipc/purchases.ipc');
const { registerSettingsIpc } = require('./ipc/settings.ipc');
const { registerBackupIpc } = require('./ipc/backup.ipc');
const { registerGlobalIpc } = require('./ipc/global.ipc');
const { registerDevPanelIpc } = require('./ipc/devpanel.ipc');
const { installAuditMiddleware, pruneAuditLog } = require('./devpanel/auditMiddleware');
const { installSyncTriggerMiddleware } = require('./sync/syncTrigger');
const { startDiscovery, stopDiscovery } = require('./sync/discovery');
const { startSyncServer, stopSyncServer } = require('./sync/syncServer');
const { startPeriodicSync, stopSyncTimers, DEFAULT_SYNC_PORT } = require('./sync/syncEngine');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ARWAAT Stationery Systems',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  try {
    initDatabase();
      // Must run before any register*Ipc() call below — it patches
      // ipcMain.handle in place so every channel every module registers
      // (including the ones below) gets audited with no per-module changes.
      installAuditMiddleware(ipcMain);
      // Same patch-ipcMain.handle trick, for the same reason: every write any
      // module makes should debounce a sync attempt, without editing every
      // module. Order relative to installAuditMiddleware doesn't matter —
      // each wraps whatever `ipcMain.handle` currently is.
      installSyncTriggerMiddleware(ipcMain);
      pruneAuditLog();
      registerAuthIpc();
      registerUsersIpc();
      registerDashboardIpc();
      registerCategoriesIpc();
      registerProductsIpc();
      registerStockIpc();
      registerSuppliersIpc();
      registerCustomersIpc();
      registerLedgersIpc();
      registerLetterheadsIpc();
      registerSalesIpc();
      registerPrintingIpc();
      registerPaymentsIpc();
      registerReportsIpc();
      registerExpensesIpc();
      registerSyncIpc();
      registerPurchasesIpc();
      registerSettingsIpc();
      registerBackupIpc();
      registerGlobalIpc();
      registerDevPanelIpc();
      seedDummyCashier();
      // Catches up any recurring expenses (daily/weekly/monthly/annually)
      // due since the app was last opened, so All Expenses and the reports
      // that read `expenses` are current from the first render.
      generateDueRecurringExpenses();

      // Every PC — Admin and Cashier alike — runs the sync server and joins
      // discovery, and syncs on a timer in the background. Safe to start
      // even before Setup finishes: the server 401s until a sync_secret
      // exists, and discovery just listens (announcing nothing of its own)
      // until this PC has a station_code/role to broadcast.
      startSyncServer(DEFAULT_SYNC_PORT);
      startDiscovery(DEFAULT_SYNC_PORT);
      startPeriodicSync();
    console.log('Database initialized successfully at startup.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  ipcMain.handle('ping', () => 'pong');

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopSyncTimers();
  stopDiscovery();
  stopSyncServer();
  if (process.platform !== 'darwin') app.quit();
});
console.log('NODE_ENV is:', process.env.NODE_ENV);
