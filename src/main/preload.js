const { contextBridge, ipcRenderer } = require('electron');

// Any call that can change stock levels or the product list tells the page
// (via a plain DOM event) so the header's Running Low badge refreshes at once.
const STOCK_CHANNELS = new Set([
  'products:create', 'products:update', 'products:set-active', 'products:bulk-set-active', 'products:bulk-import',
  'products:quick-add', 'products:approve-review', 'products:merge-review',
  'stock:adjust', 'stock:add', 'stock:remove', 'purchases:create',
  'sales:create', 'sales:update', 'sales:void', 'returns:create', 'returns:create-no-bill',
]);
// The main process refuses calls from a window whose session ended (expired,
// revoked, signed out elsewhere); the page hears about it and returns to Login.
const SESSION_ENDED_REASON = 'Please sign in again.';

function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args).then((res) => {
    if (STOCK_CHANNELS.has(channel)) window.dispatchEvent(new Event('pos:stock-changed'));
    if (res && res.success === false && res.reason === SESSION_ENDED_REASON) window.dispatchEvent(new Event('pos:session-ended'));
    return res;
  });
}

// Which app this window is ('admin' | 'cashier'), from the launch argument main
// passes in. Display only — main keeps its own record and never trusts this.
const modeArg = process.argv.find((a) => a.startsWith('--arwaat-mode='));
const APP_MODE = modeArg ? modeArg.slice('--arwaat-mode='.length) : null;

contextBridge.exposeInMainWorld('api', {
  ping: () => invoke('ping'),

  app: {
    mode: APP_MODE,
    openWindow: (data) => invoke('app:open-window', data),
    getClockStatus: () => invoke('app:get-clock-status'),
    setBusy: (data) => invoke('app:set-busy', data),
  },

  // Admin only (checked in main): in-app updates.
  updates: {
    getState: () => invoke('updates:get-state'),
    check: () => invoke('updates:check'),
    download: () => invoke('updates:download'),
    install: () => invoke('updates:install'),
    consumeUpdatedNotice: () => invoke('updates:consume-updated-notice'),
  },

  setup: {
    getStatus: () => invoke('setup:get-status'),
    createAdmin: (data) => invoke('setup:create-admin', data),
    joinAsCashier: (data) => invoke('setup:join-as-cashier', data),
  },

  users: {
    login: (data) => invoke('users:login', data),
    validateSession: (data) => invoke('users:validate-session', data),
    getRecoveryAccounts: () => invoke('users:get-recovery-accounts'),
    recoverPassword: (data) => invoke('users:recover-password', data),
    logout: (data) => invoke('users:logout', data),
    verifyPassword: (data) => invoke('users:verify-password', data),
    getPermissions: (data) => invoke('users:get-permissions', data),
    list: (data) => invoke('users:list', data),
    createCashier: (data) => invoke('users:create-cashier', data),
    update: (data) => invoke('users:update', data),
    checkUsernameUnique: (data) => invoke('users:check-username-unique', data),
    resetPassword: (data) => invoke('users:reset-password', data),
    setActive: (data) => invoke('users:set-active', data),
  },

  permissions: {
    getDefinitions: () => invoke('permissions:get-definitions'),
    getForUser: (data) => invoke('permissions:get-for-user', data),
    saveForUser: (data) => invoke('permissions:save-for-user', data),
  },

  sessions: {
    list: (data) => invoke('sessions:list', data),
    getDetail: (data) => invoke('sessions:get-detail', data),
  },

  dashboard: {
    getSummary: () => invoke('dashboard:get-summary'),
    getRevenueTrend: (data) => invoke('dashboard:get-revenue-trend', data),
    getActiveSessions: () => invoke('dashboard:get-active-sessions'),
  },

  categories: {
    list: () => invoke('categories:list'),
    create: (data) => invoke('categories:create', data),
    update: (data) => invoke('categories:update', data),
    delete: (data) => invoke('categories:delete', data),
  },

  products: {
    list: (data) => invoke('products:list', data),
    getById: (data) => invoke('products:get-by-id', data),
    transliterateUrdu: (data) => invoke('products:transliterate-urdu', data),
    create: (data) => invoke('products:create', data),
    update: (data) => invoke('products:update', data),
    setActive: (data) => invoke('products:set-active', data),
    bulkSetActive: (data) => invoke('products:bulk-set-active', data),
    bulkSetCategory: (data) => invoke('products:bulk-set-category', data),
    checkSkuUnique: (data) => invoke('products:check-sku-unique', data),
    checkBarcodeUnique: (data) => invoke('products:check-barcode-unique', data),
    getLowStock: () => invoke('products:get-low-stock'),
    getDeadStock: () => invoke('products:get-dead-stock'),
    bulkImport: (data) => invoke('products:bulk-import', data),
    quickAdd: (data) => invoke('products:quick-add', data),
    findSimilar: (data) => invoke('products:find-similar', data),
    listNeedsReview: () => invoke('products:list-needs-review'),
    approveReview: (data) => invoke('products:approve-review', data),
    mergeReview: (data) => invoke('products:merge-review', data),
  },

  stock: {
    getAdjustmentReasons: () => invoke('stock:get-adjustment-reasons'),
    adjust: (data) => invoke('stock:adjust', data),
    getMovements: (data) => invoke('stock:get-movements', data),
    add: (data) => invoke('stock:add', data),
    remove: (data) => invoke('stock:remove', data),
    getProductStats: (data) => invoke('stock:get-product-stats', data),
    listRecount: () => invoke('stock:list-recount'),
    resolveRecount: (data) => invoke('stock:resolve-recount', data),
  },

  // Rule 12: Admin approval box (signed-in) + approvals log (Admin).
  approvals: {
    request: (data) => invoke('approvals:request', data),
    list: (data) => invoke('approvals:list', data),
  },

  suppliers: {
    list: (data) => invoke('suppliers:list', data),
    getById: (data) => invoke('suppliers:get-by-id', data),
    create: (data) => invoke('suppliers:create', data),
    update: (data) => invoke('suppliers:update', data),
    setActive: (data) => invoke('suppliers:set-active', data),
    searchMinimal: (data) => invoke('suppliers:search-minimal', data),
    getLedger: (data) => invoke('suppliers:get-ledger', data),
    getNextId: () => invoke('suppliers:get-next-id'),
  },

  purchases: {
    create: (data) => invoke('purchases:create', data),
    getReceiptData: (data) => invoke('purchases:get-receipt-data', data),
    list: (data) => invoke('purchases:list', data),
    getDetail: (data) => invoke('purchases:get-detail', data),
  },

  customers: {
    list: (data) => invoke('customers:list', data),
    getById: (data) => invoke('customers:get-by-id', data),
    create: (data) => invoke('customers:create', data),
    update: (data) => invoke('customers:update', data),
    setActive: (data) => invoke('customers:set-active', data),
    searchMinimal: (data) => invoke('customers:search-minimal', data),
    getLedger: (data) => invoke('customers:get-ledger', data),
    getNextId: () => invoke('customers:get-next-id'),
    creditCheck: (data) => invoke('customers:credit-check', data),
    checkDuplicatePhone: (data) => invoke('customers:check-duplicate-phone', data),
    getSpecialPrices: (data) => invoke('customers:get-special-prices', data),
    saveSpecialPrice: (data) => invoke('customers:save-special-price', data),
    deleteSpecialPrice: (data) => invoke('customers:delete-special-price', data),
  },

  ledgers: {
    getOverview: () => invoke('ledgers:get-overview'),
    getPaymentHistory: (data) => invoke('ledgers:get-payment-history', data),
    getAdvances: () => invoke('ledgers:get-advances'),
    getAgingReport: () => invoke('ledgers:get-aging-report'),
    listAdjustments: () => invoke('ledgers:list-adjustments'),
    createAdjustment: (data) => invoke('ledgers:create-adjustment', data),
    getPaymentById: (data) => invoke('ledgers:get-payment-by-id', data),
  },

  payments: {
    createStandalone: (data) => invoke('payments:create-standalone', data),
    createSupplierPayment: (data) => invoke('payments:create-supplier-payment', data),
    delete: (data) => invoke('payments:delete', data),
  },

  letterheads: {
    list: () => invoke('letterheads:list'),
    getById: (data) => invoke('letterheads:get-by-id', data),
    pickPdf: () => invoke('letterheads:pick-pdf'),
    create: (data) => invoke('letterheads:create', data),
    update: (data) => invoke('letterheads:update', data),
    delete: (data) => invoke('letterheads:delete', data),
    downloadTemplate: () => invoke('letterheads:download-template'),
    downloadWordTemplate: () => invoke('letterheads:download-word-template'),
  },

  settings: {
    getAll: () => invoke('settings:get-all'),
    set: (data) => invoke('settings:set', data),
    setMany: (data) => invoke('settings:set-many', data),
  },

  backup: {
    export: () => invoke('backup:export'),
    restore: () => invoke('backup:restore'),
    relaunchApp: () => invoke('backup:relaunch-app'),
    validateAndRestore: () => invoke('backup:validate-and-restore'),
    getAutoStatus: () => invoke('backup:get-auto-status'),
    pickAutoFolder: () => invoke('backup:pick-auto-folder'),
    setAutoFolder: (data) => invoke('backup:set-auto-folder', data),
    runAutoNow: () => invoke('backup:run-auto-now'),
    usbReminderDone: () => invoke('backup:usb-reminder-done'),
  },

  system: {
    factoryReset: () => invoke('system:factory-reset'),
  },

  printers: {
    listInstalled: () => invoke('printers:list-installed'),
    testPrint: () => invoke('printers:test-print'),
  },

  sync: {
    getStatus: () => invoke('sync:get-status'),
    getLog: () => invoke('sync:get-log'),
    getPeers: () => invoke('sync:get-peers'),
    triggerNow: (data) => invoke('sync:trigger-now', data),
    getReconciliationWarnings: () => invoke('sync:get-reconciliation-warnings'),
    getSecret: () => invoke('sync:get-secret'),
  },

  expenses: {
    list: (data) => invoke('expenses:list', data),
    getById: (data) => invoke('expenses:get-by-id', data),
    create: (data) => invoke('expenses:create', data),
    update: (data) => invoke('expenses:update', data),
    delete: (data) => invoke('expenses:delete', data),
    stopRecurrence: (data) => invoke('expenses:stop-recurrence', data),
  },

  sales: {
    searchProducts: (data) => invoke('sales:search-products', data),
    searchProductsGrouped: (data) => invoke('sales:search-products-grouped', data),
    getVariantByBarcode: (data) => invoke('sales:get-variant-by-barcode', data),
    getVariantForCart: (data) => invoke('sales:get-variant-for-cart', data),
    resolvePrice: (data) => invoke('sales:resolve-price', data),
    getNextInvoiceNo: () => invoke('sales:get-next-invoice-no'),
    getCashierDiscountCap: (data) => invoke('sales:get-cashier-discount-cap', data),
    create: (data) => invoke('sales:create', data),
    update: (data) => invoke('sales:update', data),
    void: (data) => invoke('sales:void', data),
    listRecent: (data) => invoke('sales:list-recent', data),
    getForEdit: (data) => invoke('sales:get-for-edit', data),
    getSaleDetail: (data) => invoke('sales:get-sale-detail', data),
    getProductTypes: (data) => invoke('sales:get-product-types', data),
    getReceiptData: (data) => invoke('sales:get-receipt-data', data),
    getDraftReceipt: (data) => invoke('sales:get-draft-receipt', data),
    list: (data) => invoke('sales:list', data),
    getDetail: (data) => invoke('sales:get-detail', data),
  },

  returns: {
    list: (data) => invoke('returns:list', data),
    getDetail: (data) => invoke('returns:get-detail', data),
    getReturnable: (data) => invoke('returns:get-returnable', data),
    create: (data) => invoke('returns:create', data),
    searchSales: (data) => invoke('returns:search-sales', data),
    noBillPrice: (data) => invoke('returns:no-bill-price', data),
    createNoBill: (data) => invoke('returns:create-no-bill', data),
  },

  printing: {
    printSale: (data) => invoke('printing:print-sale', data),
    previewSale: (data) => invoke('printing:preview-sale', data),
    previewDraft: (data) => invoke('printing:preview-draft', data),
    previewPurchase: (data) => invoke('printing:preview-purchase', data),
    printPurchase: (data) => invoke('printing:print-purchase', data),
    savePdf: (data) => invoke('printing:save-pdf', data),
    printPaymentReceipt: (data) => invoke('printing:print-payment-receipt', data),
  },

  reports: {
    getSalesReport: (data) => invoke('reports:get-sales-report', data),
    getProfitLoss: (data) => invoke('reports:get-profit-loss', data),
    getStockReport: (data) => invoke('reports:get-stock-report', data),
    getCustomerStatements: (data) => invoke('reports:get-customer-statements', data),
    getSupplierStatements: (data) => invoke('reports:get-supplier-statements', data),
    getCashierPerformance: (data) => invoke('reports:get-cashier-performance', data),
    getExpenseReport: (data) => invoke('reports:get-expense-report', data),
    getReport: (data) => invoke('reports:get-report', data),
    exportCsv: (data) => invoke('reports:export-csv', data),
    exportPdf: (data) => invoke('reports:export-pdf', data),
  },

  global: {
    search: (data) => invoke('global:search', data),
  },

  devpanel: {
    verifyPassword: (data) => invoke('devpanel:verify-password', data),
    changePassword: (data) => invoke('devpanel:change-password', data),
    getAuditLog: (data) => invoke('devpanel:get-audit-log', data),
    listTables: () => invoke('devpanel:list-tables'),
    getTableRows: (data) => invoke('devpanel:get-table-rows', data),
    runSelectQuery: (data) => invoke('devpanel:run-select-query', data),
    getUsersSessions: () => invoke('devpanel:get-users-sessions'),
    getSystemInfo: () => invoke('devpanel:get-system-info'),
    getAccessLog: (data) => invoke('devpanel:get-access-log', data),
  },
});