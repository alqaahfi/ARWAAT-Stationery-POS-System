const { app, ipcMain } = require('electron');
const { initDatabase, getDb, StartupProblem } = require('./db/connection');
const { registerSetupIpc } = require('./ipc/setup.ipc');
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
const { registerSalesHistoryIpc } = require('./ipc/salesHistory.ipc');
const { registerReturnsIpc } = require('./ipc/returns.ipc');
const { registerPrintingIpc } = require('./ipc/printing.ipc');
const { registerPaymentsIpc } = require('./ipc/payments.ipc');
const { registerReportsIpc } = require('./ipc/reports.ipc');
const { registerExpensesIpc } = require('./ipc/expenses.ipc');
const { generateDueRecurringExpenses } = require('./expenses/recurringExpenses');
const { registerSyncIpc } = require('./ipc/sync.ipc');
const { registerPurchasesIpc } = require('./ipc/purchases.ipc');
const { registerSettingsIpc } = require('./ipc/settings.ipc');
const { registerBackupIpc } = require('./ipc/backup.ipc');
const { registerSystemIpc } = require('./ipc/system.ipc');
const { registerGlobalIpc } = require('./ipc/global.ipc');
const { registerDevPanelIpc } = require('./ipc/devpanel.ipc');
const { installAuditMiddleware, pruneAuditLog } = require('./devpanel/auditMiddleware');
const { installSyncTriggerMiddleware } = require('./sync/syncTrigger');
const { startDiscovery, stopDiscovery } = require('./sync/discovery');
const { startSyncServer, stopSyncServer } = require('./sync/syncServer');
const { startPeriodicSync, stopSyncTimers, DEFAULT_SYNC_PORT } = require('./sync/syncEngine');
const { installIpcGuard } = require('./security/ipcGuard');
const { registerAppIpc } = require('./ipc/app.ipc');
const { registerApprovalsIpc } = require('./ipc/approvals.ipc');
const { startAutoBackup, stopAutoBackup } = require('./backup/autoBackup');
const { modeFromArgv, openModeWindow, installWebContentsHardening } = require('./windows');
const { registerUpdatesIpc } = require('./ipc/updates.ipc');
const updater = require('./update/updater');
const { readPending, clearPending } = require('./update/pendingUpdate');
const { showRecoveryWindow } = require('./update/recovery');

// One process serves both apps (Admin and Cashier windows) so only one copy
// ever owns the DB, the sync server port and UDP discovery. A second launch
// (the other shortcut) is handed to this process via 'second-instance'.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (event, argv) => {
    if (app.isReady()) openModeWindow(modeFromArgv(argv));
  });
  installWebContentsHardening();
  app.whenReady().then(boot);
}

// Start-up checks happen BEFORE any window or service: integrity check, downgrade
// guard, every pending migration (each in its own transaction). If the data can't be
// opened safely, only the recovery screen is shown — never the app on a half-migrated database.
function openDatabaseOrNull() {
  try {
    initDatabase();
    return null;
  } catch (err) {
    console.error('Failed to initialize database:', err);
    return err instanceof StartupProblem
      ? err
      : new StartupProblem('integrity', 'The database could not be opened.', err && err.message ? err.message : String(err));
  }
}

// After a successful start: an update that was installed is now finished.
// Returns the windows (modes) that were open when the update began.
function finishPendingUpdate() {
  const pending = readPending();
  if (!pending) return [];
  try {
    const finished = pending.to === app.getVersion();
    if (finished) updater.noteUpdated(pending.to); // one-time "Updated to version X" on Home
    clearPending(getDb());
    return finished && Array.isArray(pending.windows) ? pending.windows : [];
  } catch (err) {
    console.error('Could not clear the pending update record:', err);
    return [];
  }
}

function boot() {
  const problem = openDatabaseOrNull();
  if (problem) {
    showRecoveryWindow({ kind: problem.kind, detail: problem.detail });
    return;
  }
  const reopenWindows = finishPendingUpdate();
  try {
      // Must run before any register*Ipc() call below — it patches
      // ipcMain.handle in place so every channel every module registers
      // (including the ones below) gets audited with no per-module changes.
      installAuditMiddleware(ipcMain);
      // Same patch-ipcMain.handle trick, for the same reason: every write any
      // module makes should debounce a sync attempt, without editing every
      // module. Order relative to installAuditMiddleware doesn't matter —
      // each wraps whatever `ipcMain.handle` currently is.
      installSyncTriggerMiddleware(ipcMain);
      // Installed last so it sits innermost: audit still records refused
      // calls, and nothing reaches a handler without passing the check.
      installIpcGuard(ipcMain);
      pruneAuditLog();
      registerSetupIpc();
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
      registerSalesHistoryIpc();
      registerReturnsIpc();
      registerPrintingIpc();
      registerPaymentsIpc();
      registerReportsIpc();
      registerExpensesIpc();
      registerSyncIpc();
      registerPurchasesIpc();
      registerSettingsIpc();
      registerBackupIpc();
      registerSystemIpc();
      registerGlobalIpc();
      registerDevPanelIpc();
      registerAppIpc();
      registerApprovalsIpc();
      registerUpdatesIpc();
      // Demo login for development only — never created in an installed build.
      if (!app.isPackaged) seedDummyCashier();
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
      // Rule 16: today's automatic backup (if not done yet), then every midnight.
      startAutoBackup();
      // Quiet update check shortly after start and every 24 h (installed app only).
      updater.start();
    console.log('Database initialized successfully at startup.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }

  ipcMain.handle('ping', () => 'pong');

  const mainMode = modeFromArgv(process.argv);
  openModeWindow(mainMode);
  // After an update: bring back the other window that was open when it began.
  for (const mode of reopenWindows) if (mode !== mainMode) openModeWindow(mode);
}

// Closing one window leaves the other running; the app quits with the last one.
app.on('window-all-closed', () => {
  // While an update is being installed the updater shuts everything down itself.
  if (updater.isInstalling()) return;
  stopSyncTimers();
  stopAutoBackup();
  stopDiscovery();
  stopSyncServer();
  app.quit();
});
console.log('NODE_ENV is:', process.env.NODE_ENV);
