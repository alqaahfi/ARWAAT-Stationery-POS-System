// Report pages get their title from navConfig's ROUTE_TITLES inside
// AdminDashboard's topbar. The print view has no sidebar/topbar to read that
// from, so it needs its own copy, keyed the same way as the IPC reportType.
export const REPORT_TITLES = {
  sales: 'Sales Report',
  'profit-loss': 'Profit & Loss',
  stock: 'Stock Report',
  customers: 'Customer Statements',
  suppliers: 'Supplier Statements',
  cashiers: 'Cashier Performance',
  expenses: 'Expense Report',
};
