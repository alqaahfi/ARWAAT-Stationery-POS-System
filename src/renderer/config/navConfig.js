// src/renderer/config/navConfig.js
//
// The Admin app's whole map. Each entry is one sidebar item (a "section"):
//   group     — sidebar group header (null = above the groups, e.g. Home)
//   icon      — a key into config/appIcons.js
//   route     — where the sidebar item goes
//   tabs      — the section's sub-pages, shown as a SegmentedControl at the
//               top of the page (only when 2+ are visible)
//   pages     — other routes that belong to the section but aren't tabs
//               (forms, detail views); they show a "‹ Section" back button
//   children  — tabs + pages, kept for older code that walks the tree
// Visibility: `adminOnly` is a hard role gate, `permissionKey` a cashier
// permission (admin implicitly has every permission).
//
// New Sale (/pos) isn't a section — it's the button at the top of the sidebar.
// Receive Payment (/payments/record) isn't a sidebar item — it's a page of Customers,
// opened from a customer's profile.

import glossary from './glossary';

const g = glossary;

function section(def) {
  const tabs = def.tabs || [];
  const pages = def.pages || [];
  return { permissionKey: null, adminOnly: false, ...def, tabs, pages, children: [...tabs, ...pages] };
}

const navConfig = [
  section({ key: 'dashboard', label: g.home, icon: 'home', group: null, route: '/dashboard' }),
  section({
    key: 'customers',
    label: g.customers,
    icon: 'customers',
    group: null,
    route: '/customers',
    adminOnly: true,
    tabs: [{ key: 'customers-all', label: g.allCustomers, route: '/customers' }],
    pages: [
      { key: 'customers-receive-payment', label: g.receivePayment, route: '/payments/record', needsParams: true },
      { key: 'customers-new', label: g.addCustomer, route: '/customers/new' },
      { key: 'customers-edit', label: g.customer, route: '/customers/edit', needsParams: true },
    ],
  }),
  section({
    key: 'suppliers',
    label: g.suppliers,
    icon: 'suppliers',
    group: null,
    route: '/suppliers',
    adminOnly: true,
    tabs: [{ key: 'suppliers-all', label: g.suppliers, route: '/suppliers' }],
    pages: [
      { key: 'suppliers-new', label: g.addSupplier, route: '/suppliers/new' },
      { key: 'suppliers-edit', label: g.supplier, route: '/suppliers/edit', needsParams: true },
    ],
  }),
  section({
    key: 'products',
    label: g.products,
    icon: 'products',
    group: null,
    route: '/products',
    tabs: [
      { key: 'products-all', label: g.allProducts, route: '/products', permissionKey: 'view_products' },
      { key: 'products-low-stock', label: g.runningLow, route: '/products/low-stock', permissionKey: 'view_products' },
      { key: 'products-dead-stock', label: g.notSelling, route: '/products/dead-stock' },
      { key: 'products-categories', label: g.categories, route: '/products/categories' },
      { key: 'products-adjustments', label: g.fixStockCount, route: '/products/stock-adjustments' },
      { key: 'products-movements', label: g.stockHistory, route: '/products/stock-movements' },
    ],
    pages: [
      { key: 'products-new', label: g.addProduct, route: '/products/new' },
      { key: 'products-edit', label: g.editProduct, route: '/products/edit', needsParams: true },
      { key: 'products-bulk-import', label: g.importSpreadsheet, route: '/products/bulk-import' },
    ],
  }),
  section({
    key: 'sales',
    label: g.sale,
    icon: 'sales',
    group: null,
    route: '/sales',
    tabs: [
      { key: 'sales-history', label: g.sales, route: '/sales', permissionKey: 'view_sales_history' },
      { key: 'sales-returns', label: g.returns, route: '/sales/returns' },
    ],
  }),
  section({
    key: 'purchase',
    label: g.purchase,
    icon: 'purchases',
    group: null,
    route: '/products/purchases',
    adminOnly: true,
    tabs: [{ key: 'purchase-history', label: g.purchases, route: '/products/purchases' }],
  }),
  section({
    key: 'ledgers',
    label: g.ledgers,
    icon: 'accounts',
    group: null,
    route: '/ledgers',
    adminOnly: true,
    tabs: [
      { key: 'ledgers-overview', label: g.overview, route: '/ledgers' },
      { key: 'ledgers-customers', label: g.customerAccounts, route: '/ledgers/customers' },
      { key: 'ledgers-suppliers', label: g.supplierAccounts, route: '/ledgers/suppliers' },
      { key: 'ledgers-payments', label: g.payments, route: '/ledgers/payments' },
      { key: 'ledgers-advances', label: g.paidInAdvance, route: '/ledgers/advances' },
      { key: 'ledgers-aging', label: g.overduePayments, route: '/ledgers/aging' },
      { key: 'ledgers-adjustments', label: g.balanceCorrections, route: '/ledgers/adjustments' },
    ],
  }),
  section({
    key: 'expenses',
    label: g.expenses,
    icon: 'expenses',
    group: null,
    route: '/expenses',
    permissionKey: 'manage_expenses',
    tabs: [{ key: 'expenses-all', label: g.expenses, route: '/expenses', permissionKey: 'manage_expenses' }],
    pages: [
      { key: 'expenses-new', label: g.addExpense, route: '/expenses/new', permissionKey: 'manage_expenses' },
      { key: 'expenses-edit', label: g.editExpense, route: '/expenses/edit', permissionKey: 'manage_expenses', needsParams: true },
    ],
  }),
  section({
    key: 'reports',
    label: g.reports,
    icon: 'reports',
    group: null,
    route: '/reports',
    permissionKey: 'view_reports',
    tabs: [
      { key: 'reports-all', label: g.allReports, route: '/reports', adminOnly: true },
      { key: 'reports-sales', label: g.sales, route: '/reports/sales', permissionKey: 'view_reports' },
      { key: 'reports-profit-loss', label: g.profitLoss, route: '/reports/profit-loss' },
      { key: 'reports-stock', label: g.stock, route: '/reports/stock' },
      { key: 'reports-customers', label: g.customers, route: '/reports/customers' },
      { key: 'reports-suppliers', label: g.suppliers, route: '/reports/suppliers' },
      { key: 'reports-cashiers', label: g.cashiers, route: '/reports/cashiers' },
      { key: 'reports-expenses', label: g.expenses, route: '/reports/expenses' },
    ],
  }),
  section({
    key: 'cashiers',
    label: g.cashiers,
    icon: 'cashiers',
    group: null,
    route: '/cashiers',
    adminOnly: true,
    tabs: [
      { key: 'cashiers-all', label: g.cashiers, route: '/cashiers' },
      { key: 'cashiers-sessions', label: g.sessionActivity, route: '/cashiers/sessions' },
    ],
    pages: [
      { key: 'cashiers-new', label: g.addCashier, route: '/cashiers/new' },
      { key: 'cashiers-edit', label: g.editCashier, route: '/cashiers/edit', needsParams: true },
      { key: 'cashiers-session-detail', label: g.sessionDetail, route: '/cashiers/sessions/detail', needsParams: true },
    ],
  }),
  section({
    key: 'settings',
    label: g.settings,
    icon: 'settings',
    group: null,
    route: '/settings/preferences',
    adminOnly: true,
    tabs: [
      { key: 'settings-preferences', label: g.preferences, route: '/settings/preferences' },
      { key: 'settings-receipt-content', label: g.receiptHeaderFooter, route: '/settings/receipt-content' },
      { key: 'settings-letterheads', label: g.letterheads, route: '/settings/letterheads' },
      { key: 'settings-printers', label: g.printers, route: '/settings/printers' },
      { key: 'settings-sync', label: g.connectedComputers, route: '/settings/sync' },
      { key: 'settings-backup', label: g.backupRestore, route: '/settings/backup' },
      { key: 'settings-license', label: g.license, route: '/settings/license' },
    ],
  }),
];

export default navConfig;

// Sidebar group headers. Empty: the sidebar is one flat list in the order of navConfig.
export const NAV_GROUPS = [];

// Flat lookup: route -> display title. A section's own tabs map to the
// section name; forms/detail pages map to their own label.
export const ROUTE_TITLES = navConfig.reduce((acc, s) => {
  acc[s.route] = s.label;
  for (const tab of s.tabs) acc[tab.route] = s.label;
  for (const page of s.pages) acc[page.route] = page.label;
  return acc;
}, {});

// route -> { section, tab } for tab routes, { section, page } for the other
// routes a section owns, or null (e.g. /pos).
export function getSectionForRoute(route) {
  for (const s of navConfig) {
    const tab = s.tabs.find((t) => t.route === route);
    if (tab) return { section: s, tab };
    const page = s.pages.find((p) => p.route === route);
    if (page) return { section: s, page };
    if (s.route === route) return { section: s };
  }
  return null;
}

// Same rules the app has always used: admin sees everything; otherwise a
// hard role gate first, then the cashier permission.
export function canSee(item, user, hasPermission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (item.adminOnly) return false;
  return !item.permissionKey || hasPermission(item.permissionKey);
}

export function visibleTabs(section, user, hasPermission) {
  if (!canSee(section, user, hasPermission)) return [];
  return section.tabs.filter((t) => canSee(t, user, hasPermission));
}

export function visibleSections(user, hasPermission) {
  return navConfig.filter((s) => canSee(s, user, hasPermission) && (s.tabs.length === 0 || visibleTabs(s, user, hasPermission).length > 0));
}

// Where a sidebar item goes: its main route, or its first tab the user may see.
export function sectionEntryRoute(section, user, hasPermission) {
  const tabs = visibleTabs(section, user, hasPermission);
  return tabs.some((t) => t.route === section.route) || !tabs.length ? section.route : tabs[0].route;
}
