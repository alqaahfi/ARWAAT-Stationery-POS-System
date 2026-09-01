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
const { registerExpenseCategoriesIpc } = require('./ipc/expenseCategories.ipc');
const { registerExpensesIpc } = require('./ipc/expenses.ipc');
const { registerSyncIpc } = require('./ipc/sync.ipc');
const { registerPurchasesIpc } = require('./ipc/purchases.ipc');
const { registerSettingsIpc } = require('./ipc/settings.ipc');
const { registerBackupIpc } = require('./ipc/backup.ipc');
const { registerGlobalIpc } = require('./ipc/global.ipc');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
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
      registerExpenseCategoriesIpc();
      registerExpensesIpc();
      registerSyncIpc();
      registerPurchasesIpc();
      registerSettingsIpc();
      registerBackupIpc();
      registerGlobalIpc();
      seedDummyCashier();
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
  if (process.platform !== 'darwin') app.quit();
});
console.log('NODE_ENV is:', process.env.NODE_ENV);
