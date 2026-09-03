const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),

  license: {
    getMachineId: () => ipcRenderer.invoke('license:get-machine-id'),
    getStatus: () => ipcRenderer.invoke('license:get-status'),
    activateAdmin: (data) => ipcRenderer.invoke('license:activate-admin', data),
    activateCashier: (data) => ipcRenderer.invoke('license:activate-cashier', data),
  },

  users: {
    hasAnyUser: () => ipcRenderer.invoke('users:has-any-user'),
    createFirstAdmin: (data) => ipcRenderer.invoke('users:create-first-admin', data),
    login: (data) => ipcRenderer.invoke('users:login', data),
    validateSession: (data) => ipcRenderer.invoke('users:validate-session', data),
    logout: (data) => ipcRenderer.invoke('users:logout', data),
    getPermissions: (data) => ipcRenderer.invoke('users:get-permissions', data),
    list: (data) => ipcRenderer.invoke('users:list', data),
    createCashier: (data) => ipcRenderer.invoke('users:create-cashier', data),
    update: (data) => ipcRenderer.invoke('users:update', data),
    checkUsernameUnique: (data) => ipcRenderer.invoke('users:check-username-unique', data),
    resetPassword: (data) => ipcRenderer.invoke('users:reset-password', data),
    setActive: (data) => ipcRenderer.invoke('users:set-active', data),
  },

  permissions: {
    getDefinitions: () => ipcRenderer.invoke('permissions:get-definitions'),
    getForUser: (data) => ipcRenderer.invoke('permissions:get-for-user', data),
    saveForUser: (data) => ipcRenderer.invoke('permissions:save-for-user', data),
  },

  sessions: {
    list: (data) => ipcRenderer.invoke('sessions:list', data),
    getDetail: (data) => ipcRenderer.invoke('sessions:get-detail', data),
  },

  dashboard: {
    getSummary: () => ipcRenderer.invoke('dashboard:get-summary'),
    getRevenueTrend: (data) => ipcRenderer.invoke('dashboard:get-revenue-trend', data),
    getActiveSessions: () => ipcRenderer.invoke('dashboard:get-active-sessions'),
  },

  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    create: (data) => ipcRenderer.invoke('categories:create', data),
    update: (data) => ipcRenderer.invoke('categories:update', data),
    delete: (data) => ipcRenderer.invoke('categories:delete', data),
  },

  products: {
    list: (data) => ipcRenderer.invoke('products:list', data),
    getById: (data) => ipcRenderer.invoke('products:get-by-id', data),
    create: (data) => ipcRenderer.invoke('products:create', data),
    update: (data) => ipcRenderer.invoke('products:update', data),
    setActive: (data) => ipcRenderer.invoke('products:set-active', data),
    bulkSetActive: (data) => ipcRenderer.invoke('products:bulk-set-active', data),
    bulkSetCategory: (data) => ipcRenderer.invoke('products:bulk-set-category', data),
    checkSkuUnique: (data) => ipcRenderer.invoke('products:check-sku-unique', data),
    checkBarcodeUnique: (data) => ipcRenderer.invoke('products:check-barcode-unique', data),
    getLowStock: () => ipcRenderer.invoke('products:get-low-stock'),
    getDeadStock: () => ipcRenderer.invoke('products:get-dead-stock'),
    bulkImport: (data) => ipcRenderer.invoke('products:bulk-import', data),
  },

  stock: {
    getAdjustmentReasons: () => ipcRenderer.invoke('stock:get-adjustment-reasons'),
    adjust: (data) => ipcRenderer.invoke('stock:adjust', data),
    getMovements: (data) => ipcRenderer.invoke('stock:get-movements', data),
  },

  suppliers: {
    list: (data) => ipcRenderer.invoke('suppliers:list', data),
    getById: (data) => ipcRenderer.invoke('suppliers:get-by-id', data),
    create: (data) => ipcRenderer.invoke('suppliers:create', data),
    update: (data) => ipcRenderer.invoke('suppliers:update', data),
    setActive: (data) => ipcRenderer.invoke('suppliers:set-active', data),
    searchMinimal: (data) => ipcRenderer.invoke('suppliers:search-minimal', data),
    getLedger: (data) => ipcRenderer.invoke('suppliers:get-ledger', data),
  },

  purchases: {
    create: (data) => ipcRenderer.invoke('purchases:create', data),
  },

  customers: {
    list: (data) => ipcRenderer.invoke('customers:list', data),
    getById: (data) => ipcRenderer.invoke('customers:get-by-id', data),
    create: (data) => ipcRenderer.invoke('customers:create', data),
    update: (data) => ipcRenderer.invoke('customers:update', data),
    setActive: (data) => ipcRenderer.invoke('customers:set-active', data),
    searchMinimal: (data) => ipcRenderer.invoke('customers:search-minimal', data),
    getLedger: (data) => ipcRenderer.invoke('customers:get-ledger', data),
  },

  ledgers: {
    getOverview: () => ipcRenderer.invoke('ledgers:get-overview'),
    getPaymentHistory: (data) => ipcRenderer.invoke('ledgers:get-payment-history', data),
    getAdvances: () => ipcRenderer.invoke('ledgers:get-advances'),
    getAgingReport: () => ipcRenderer.invoke('ledgers:get-aging-report'),
    listAdjustments: () => ipcRenderer.invoke('ledgers:list-adjustments'),
    createAdjustment: (data) => ipcRenderer.invoke('ledgers:create-adjustment', data),
    getPaymentById: (data) => ipcRenderer.invoke('ledgers:get-payment-by-id', data),
  },

  percentageRules: {
    list: () => ipcRenderer.invoke('percentage-rules:list'),
    listEligibleProducts: () => ipcRenderer.invoke('percentage-rules:list-eligible-products'),
    create: (data) => ipcRenderer.invoke('percentage-rules:create', data),
    delete: (data) => ipcRenderer.invoke('percentage-rules:delete', data),
  },

  payments: {
    createStandalone: (data) => ipcRenderer.invoke('payments:create-standalone', data),
    createSupplierPayment: (data) => ipcRenderer.invoke('payments:create-supplier-payment', data),
  },

  letterheads: {
    list: () => ipcRenderer.invoke('letterheads:list'),
    getById: (data) => ipcRenderer.invoke('letterheads:get-by-id', data),
    pickPdf: () => ipcRenderer.invoke('letterheads:pick-pdf'),
    create: (data) => ipcRenderer.invoke('letterheads:create', data),
    update: (data) => ipcRenderer.invoke('letterheads:update', data),
    delete: (data) => ipcRenderer.invoke('letterheads:delete', data),
  },

  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (data) => ipcRenderer.invoke('settings:set', data),
    setMany: (data) => ipcRenderer.invoke('settings:set-many', data),
  },

  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    restore: () => ipcRenderer.invoke('backup:restore'),
    relaunchApp: () => ipcRenderer.invoke('backup:relaunch-app'),
  },

  printers: {
    listInstalled: () => ipcRenderer.invoke('printers:list-installed'),
    testPrint: () => ipcRenderer.invoke('printers:test-print'),
  },

  sync: {
    getStatus: () => ipcRenderer.invoke('sync:get-status'),
    getLog: () => ipcRenderer.invoke('sync:get-log'),
  },

  expenses: {
    list: (data) => ipcRenderer.invoke('expenses:list', data),
    getById: (data) => ipcRenderer.invoke('expenses:get-by-id', data),
    create: (data) => ipcRenderer.invoke('expenses:create', data),
    update: (data) => ipcRenderer.invoke('expenses:update', data),
    delete: (data) => ipcRenderer.invoke('expenses:delete', data),
    stopRecurrence: (data) => ipcRenderer.invoke('expenses:stop-recurrence', data),
  },

  sales: {
    searchProducts: (data) => ipcRenderer.invoke('sales:search-products', data),
    searchProductsGrouped: (data) => ipcRenderer.invoke('sales:search-products-grouped', data),
    getVariantByBarcode: (data) => ipcRenderer.invoke('sales:get-variant-by-barcode', data),
    getVariantForCart: (data) => ipcRenderer.invoke('sales:get-variant-for-cart', data),
    resolvePrice: (data) => ipcRenderer.invoke('sales:resolve-price', data),
    getNextInvoiceNo: () => ipcRenderer.invoke('sales:get-next-invoice-no'),
    getCashierDiscountCap: (data) => ipcRenderer.invoke('sales:get-cashier-discount-cap', data),
    create: (data) => ipcRenderer.invoke('sales:create', data),
    getSaleDetail: (data) => ipcRenderer.invoke('sales:get-sale-detail', data),
    getReceiptData: (data) => ipcRenderer.invoke('sales:get-receipt-data', data),
  },

  printing: {
    printSale: (data) => ipcRenderer.invoke('printing:print-sale', data),
    captureReceiptImage: (rect) => ipcRenderer.invoke('printing:capture-receipt-image', rect),
    printPaymentReceipt: (data) => ipcRenderer.invoke('printing:print-payment-receipt', data),
  },

  reports: {
    getSalesReport: (data) => ipcRenderer.invoke('reports:get-sales-report', data),
    getProfitLoss: (data) => ipcRenderer.invoke('reports:get-profit-loss', data),
    getStockReport: (data) => ipcRenderer.invoke('reports:get-stock-report', data),
    getCustomerStatements: (data) => ipcRenderer.invoke('reports:get-customer-statements', data),
    getSupplierStatements: (data) => ipcRenderer.invoke('reports:get-supplier-statements', data),
    getCashierPerformance: (data) => ipcRenderer.invoke('reports:get-cashier-performance', data),
    getExpenseReport: (data) => ipcRenderer.invoke('reports:get-expense-report', data),
    getReport: (data) => ipcRenderer.invoke('reports:get-report', data),
    exportCsv: (data) => ipcRenderer.invoke('reports:export-csv', data),
    exportPdf: (data) => ipcRenderer.invoke('reports:export-pdf', data),
  },

  global: {
    search: (data) => ipcRenderer.invoke('global:search', data),
  },

  devpanel: {
    verifyPassword: (data) => ipcRenderer.invoke('devpanel:verify-password', data),
    getAuditLog: (data) => ipcRenderer.invoke('devpanel:get-audit-log', data),
    listTables: () => ipcRenderer.invoke('devpanel:list-tables'),
    getTableRows: (data) => ipcRenderer.invoke('devpanel:get-table-rows', data),
    runSelectQuery: (data) => ipcRenderer.invoke('devpanel:run-select-query', data),
    getUsersSessions: () => ipcRenderer.invoke('devpanel:get-users-sessions'),
    getSystemInfo: () => ipcRenderer.invoke('devpanel:get-system-info'),
    getAccessLog: (data) => ipcRenderer.invoke('devpanel:get-access-log', data),
  },
});