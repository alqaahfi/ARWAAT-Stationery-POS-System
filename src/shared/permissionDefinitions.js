// Single source of truth for every cashier-gated permission in the app. Main
// process code (validation, defaults) requires this directly; the renderer's
// Permissions page gets the same catalog over IPC (`permissions:get-definitions`
// in users.ipc.js) rather than importing this file straight into the Vite
// bundle — this file uses plain CommonJS so main's `require()` keeps working,
// and the renderer never needs to load CJS through the dev-server's ESM graph.
//
// When a future module introduces a new gated feature, add an entry here
// rather than hardcoding permission keys/labels inside a page component.
const PERMISSION_DEFINITIONS = [
  {
    key: 'make_sale',
    label: 'Make Sales (POS)',
    description: 'Access the New Sale screen to process sales.',
    type: 'boolean',
  },
  {
    key: 'view_products',
    label: 'View Products & Stock',
    description: 'Browse the full product list and the low-stock report.',
    type: 'boolean',
  },
  {
    key: 'record_payment',
    label: 'Record Customer Payments',
    description: "Record a standalone payment from a customer paying down their balance.",
    type: 'boolean',
  },
  {
    key: 'max_discount_percentage',
    label: 'Maximum Discount %',
    description: 'Highest discount this cashier can apply on a sale. Leave blank to use the shop default.',
    type: 'number',
  },
  {
    key: 'view_sales_history',
    label: 'View Sales History',
    description: 'Access the list of past sales and invoices.',
    type: 'boolean',
  },
  {
    key: 'view_reports',
    label: 'View Reports',
    description: 'Access sales, stock, and financial reports.',
    type: 'boolean',
  },
  {
    key: 'add_missing_items',
    label: 'Add missing items at the counter',
    description: 'When a scanned or searched item is not in the shop list, add it on the spot (name, barcode, price). The Admin reviews it later.',
    type: 'boolean',
    defaultForNewCashier: true,
  },
  {
    key: 'manage_expenses',
    label: 'Manage Expenses',
    description: 'Add and view shop expenses.',
    type: 'boolean',
  },
];

module.exports = { PERMISSION_DEFINITIONS };
