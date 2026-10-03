import React from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_TITLES } from '../../config/navConfig';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState } from '../../components/ui';
import Sale from '../POS/Sale';
import RecordPayment from '../Payments/RecordPayment';
import SalesHistory from '../Sales/SalesHistory';
import ExpenseList from '../Expenses/ExpenseList';
import ExpenseForm from '../Expenses/ExpenseForm';
import ProductList from '../Products/ProductList';
import LowStock from '../Products/LowStock';
import SalesReport from '../Reports/SalesReport';

// The cashier menu, in display order. Each entry is also the permission gate
// for its route inside CashierRoutes below.
export const CASHIER_MENU = [
  { route: '/pos', label: glossary.newSale, permissionKey: 'make_sale', ...appIcons.sell },
  { route: '/payments/record', label: glossary.receivePayment, permissionKey: 'record_payment', ...appIcons.receivePayment },
  { route: '/sales', label: glossary.salesHistory, permissionKey: 'view_sales_history', ...appIcons.sales },
  { route: '/expenses', label: glossary.expenses, permissionKey: 'manage_expenses', ...appIcons.expenses },
  { route: '/products', label: glossary.products, permissionKey: 'view_products', ...appIcons.products },
  { route: '/products/low-stock', label: glossary.runningLow, permissionKey: 'view_products', ...appIcons.runningLow },
  { route: '/reports/sales', label: glossary.salesReport, permissionKey: 'view_reports', ...appIcons.reports },
];

// Routes that aren't in the menu but belong to a menu page.
const EXTRA_ROUTES = [
  { route: '/expenses/new', permissionKey: 'manage_expenses' },
  { route: '/expenses/edit', permissionKey: 'manage_expenses' },
];

function routePermission(route) {
  return [...CASHIER_MENU, ...EXTRA_ROUTES].find((r) => r.route === route)?.permissionKey;
}

export function cashierRouteTitle(route) {
  return CASHIER_MENU.find((m) => m.route === route)?.label || ROUTE_TITLES[route] || route;
}

// Same page components and prop conventions as AdminDashboard's switch, but
// only the pages a cashier can be given — and each one re-checks permission.
export default function CashierRoutes({ route, params = {}, onNavigate }) {
  const { hasPermission } = useAuth();
  const key = routePermission(route);

  if (!key || !hasPermission(key)) {
    if (route === '/pos') {
      return (
        <Card padding="0">
          <EmptyState
            icon={Lock}
            color="gray"
            title="You can't make sales yet"
            message={'Ask your admin to turn on "Make Sales" for your account.'}
            style={{ padding: '56px 24px' }}
          />
        </Card>
      );
    }
    return (
      <Card padding="0">
        <EmptyState
          icon={Lock}
          color="gray"
          title="You don't have access to this page"
          message="Ask your admin if you need it."
          action={<Button onClick={() => onNavigate('/pos')}>Back to {glossary.newSale}</Button>}
          style={{ padding: '56px 24px' }}
        />
      </Card>
    );
  }

  switch (route) {
    case '/pos':
      return <Sale />;
    case '/payments/record':
      return <RecordPayment params={params} />;
    case '/sales':
      return <SalesHistory onNavigate={onNavigate} saleId={params.saleId} />;
    case '/expenses':
      return <ExpenseList onNavigate={onNavigate} />;
    case '/expenses/new':
      return <ExpenseForm onDone={() => onNavigate('/expenses')} onCancel={() => onNavigate('/expenses')} />;
    case '/expenses/edit':
      return <ExpenseForm expenseId={params.id} onDone={() => onNavigate('/expenses')} onCancel={() => onNavigate('/expenses')} />;
    case '/products':
      return <ProductList onNavigate={onNavigate} focusProductId={params.focusProductId} />;
    case '/products/low-stock':
      return <LowStock onNavigate={onNavigate} />;
    case '/reports/sales':
      return <SalesReport initialDate={params.date} />;
    default:
      return null;
  }
}
