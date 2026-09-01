// src/renderer/config/navConfig.js
//
// Ledger access removed from Customers and Suppliers — now lives in its own
// top-level "Ledgers" module. Cashier Mode has moved out of here too — it's
// now the "POS" icon in the top utility bar (TopUtilityBar.jsx) instead of a
// sidebar link, so there's no 'cashier-mode' entry below.

const navConfig = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: 'LayoutDashboard',
    route: '/dashboard',
    permissionKey: null,
    children: null,
  },
  {
    key: 'record-payment',
    label: 'Record Payment',
    icon: 'Wallet',
    route: '/payments/record',
    permissionKey: 'record_payment',
    children: null,
  },
  {
    key: 'products',
    label: 'Products',
    icon: 'Package',
    route: null,
    permissionKey: null,
    children: [
      { key: 'products-all', label: 'All Products', route: '/products', permissionKey: 'view_products' },
      { key: 'products-new', label: 'Add New Product', route: '/products/new', permissionKey: null },
      { key: 'products-categories', label: 'Categories', route: '/products/categories', permissionKey: null },
      { key: 'products-low-stock', label: 'Low Stock', route: '/products/low-stock', permissionKey: 'view_products' },
      { key: 'products-dead-stock', label: 'Dead Stock', route: '/products/dead-stock', permissionKey: null },
      { key: 'products-purchases', label: 'Purchase Entry', route: '/products/purchases', permissionKey: null },
      { key: 'products-adjustments', label: 'Stock Adjustments', route: '/products/stock-adjustments', permissionKey: null },
      { key: 'products-movements', label: 'Stock Movement History', route: '/products/stock-movements', permissionKey: null },
    ],
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: 'Users',
    route: null,
    permissionKey: null,
    children: [
      { key: 'customers-all', label: 'All Customers', route: '/customers', permissionKey: null },
      { key: 'customers-new', label: 'Add Customer', route: '/customers/new', permissionKey: null },
      { key: 'customers-categories', label: 'Customer Categories (Net Rate)', route: '/customers/categories', permissionKey: null },
      { key: 'customers-percentage-rules', label: 'Percentage Pricing Rules', route: '/customers/percentage-rules', permissionKey: null },
    ],
  },
  {
    key: 'suppliers',
    label: 'Suppliers',
    icon: 'Truck',
    route: null,
    permissionKey: null,
    children: [
      { key: 'suppliers-all', label: 'All Suppliers', route: '/suppliers', permissionKey: null },
      { key: 'suppliers-new', label: 'Add Supplier', route: '/suppliers/new', permissionKey: null },
    ],
  },
  {
    key: 'ledgers',
    label: 'Ledgers',
    icon: 'BookText',
    route: null,
    permissionKey: null,
    children: [
      { key: 'ledgers-overview', label: 'Overview', route: '/ledgers', permissionKey: null },
      { key: 'ledgers-customers', label: 'Customer Ledger', route: '/ledgers/customers', permissionKey: null },
      { key: 'ledgers-suppliers', label: 'Supplier Ledger', route: '/ledgers/suppliers', permissionKey: null },
      { key: 'ledgers-payments', label: 'Payment History', route: '/ledgers/payments', permissionKey: null },
      { key: 'ledgers-advances', label: 'Advances & Credits', route: '/ledgers/advances', permissionKey: null },
      { key: 'ledgers-aging', label: 'Aging / Overdue', route: '/ledgers/aging', permissionKey: null },
      { key: 'ledgers-adjustments', label: 'Manual Adjustments', route: '/ledgers/adjustments', permissionKey: null },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    icon: 'Receipt',
    route: null,
    permissionKey: null,
    children: [
      { key: 'sales-history', label: 'Sales History', route: '/sales', permissionKey: 'view_sales_history' },
      { key: 'sales-returns', label: 'Returns / Refunds', route: '/sales/returns', permissionKey: null },
    ],
  },
  {
    key: 'expenses',
    label: 'Expenses',
    icon: 'Wallet',
    route: null,
    permissionKey: 'manage_expenses',
    children: [
      { key: 'expenses-all', label: 'All Expenses', route: '/expenses', permissionKey: 'manage_expenses' },
      { key: 'expenses-new', label: 'Add Expense', route: '/expenses/new', permissionKey: 'manage_expenses' },
      { key: 'expenses-categories', label: 'Expense Categories', route: '/expenses/categories', permissionKey: null },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    icon: 'BarChart3',
    route: null,
    permissionKey: 'view_reports',
    children: [
      { key: 'reports-sales', label: 'Sales Report', route: '/reports/sales', permissionKey: 'view_reports' },
      { key: 'reports-profit-loss', label: 'Profit & Loss', route: '/reports/profit-loss', permissionKey: null },
      { key: 'reports-stock', label: 'Stock Report', route: '/reports/stock', permissionKey: null },
      { key: 'reports-customers', label: 'Customer Statements', route: '/reports/customers', permissionKey: null },
      { key: 'reports-suppliers', label: 'Supplier Statements', route: '/reports/suppliers', permissionKey: null },
      { key: 'reports-cashiers', label: 'Cashier Performance', route: '/reports/cashiers', permissionKey: null },
      { key: 'reports-expenses', label: 'Expense Report', route: '/reports/expenses', permissionKey: null },
    ],
  },
  {
    key: 'users',
    label: 'Users',
    icon: 'ShieldCheck',
    route: null,
    permissionKey: null,
    children: [
      { key: 'users-all', label: 'All Users', route: '/users', permissionKey: null },
      { key: 'users-new', label: 'Add Cashier', route: '/users/new', permissionKey: null },
      { key: 'users-permissions', label: 'Roles & Permissions', route: '/users/permissions', permissionKey: null },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: 'Settings',
    route: null,
    permissionKey: null,
    children: [
      { key: 'settings-shop', label: 'Shop Info', route: '/settings/shop', permissionKey: null },
      { key: 'settings-letterheads', label: 'Letterheads', route: '/settings/letterheads', permissionKey: null },
      { key: 'settings-printers', label: 'Printer Settings', route: '/settings/printers', permissionKey: null },
      { key: 'settings-sync', label: 'Sync & PCs', route: '/settings/sync', permissionKey: null },
      { key: 'settings-backup', label: 'Backup & Restore', route: '/settings/backup', permissionKey: null },
      { key: 'settings-license', label: 'License Info', route: '/settings/license', permissionKey: null },
      { key: 'settings-preferences', label: 'App Preferences', route: '/settings/preferences', permissionKey: null },
    ],
  },
];

export default navConfig;

// Flat lookup: route -> display title for the topbar heading ("Parent — Child"
// for nested pages, just the label for a single-link item).
export const ROUTE_TITLES = navConfig.reduce((acc, section) => {
  if (!section.children) {
    acc[section.route] = section.label;
    return acc;
  }
  for (const child of section.children) {
    acc[child.route] = `${section.label} — ${child.label}`;
  }
  return acc;
}, {});
