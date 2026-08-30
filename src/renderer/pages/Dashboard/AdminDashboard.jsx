import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../layout/Sidebar';
import { ROUTE_TITLES } from '../../config/navConfig';
import PlaceholderPage from '../../components/PlaceholderPage';
import Overview from './Overview';
import CategoryList from '../Products/CategoryList';
import ProductList from '../Products/ProductList';
import ProductForm from '../Products/ProductForm';
import LowStock from '../Products/LowStock';
import DeadStock from '../Products/DeadStock';
import BulkImport from '../Products/BulkImport';
import PurchaseEntry from '../Products/PurchaseEntry';
import StockAdjustment from '../Products/StockAdjustment';
import MovementHistory from '../Products/MovementHistory';
import Sale from '../POS/Sale';
import CustomerList from '../Customers/CustomerList';
import CustomerForm from '../Customers/CustomerForm';
import CustomerLedger from '../Customers/CustomerLedger';
import CategoryManager from '../Customers/CategoryManager';
import PercentageRules from '../Customers/PercentageRules';
import SupplierList from '../Suppliers/SupplierList';
import SupplierForm from '../Suppliers/SupplierForm';
import SupplierLedger from '../Suppliers/SupplierLedger';
import RecordPayment from '../Payments/RecordPayment';
import UserList from '../Users/UserList';
import UserForm from '../Users/UserForm';
import PermissionsManager from '../Users/PermissionsManager';
import SalesReport from '../Reports/SalesReport';
import ProfitLoss from '../Reports/ProfitLoss';
import StockReport from '../Reports/StockReport';
import CustomerStatements from '../Reports/CustomerStatements';
import SupplierStatements from '../Reports/SupplierStatements';
import CashierPerformance from '../Reports/CashierPerformance';
import ExpenseReport from '../Reports/ExpenseReport';
import Letterheads from '../Settings/Letterheads';
import SyncAndPcs from '../Settings/SyncAndPcs';
import theme from '../../config/theme';

// Simple state-based router (no react-router in this project): `nav.route`
// matches a navConfig route string, `nav.params` carries anything a fixed
// sidebar link can't (e.g. which product id to edit).
export default function AdminDashboard({ shopName }) {
  const { user, logout } = useAuth();
  const [nav, setNav] = useState({ route: '/dashboard', params: {} });

  function navigate(route, params = {}) {
    setNav({ route, params });
  }

  function pageTitle() {
    if (nav.route === '/products/edit') return nav.params.id ? 'Edit Product' : 'Add New Product';
    if (nav.route === '/customers/edit') return 'Edit Customer';
    if (nav.route === '/customers/ledger-view') return nav.params.name ? `Ledger — ${nav.params.name}` : 'Customer Ledger';
    if (nav.route === '/suppliers/edit') return 'Edit Supplier';
    if (nav.route === '/suppliers/ledger-view') return nav.params.name ? `Ledger — ${nav.params.name}` : 'Supplier Ledger';
    if (nav.route === '/users/edit') return 'Edit Cashier';
    return ROUTE_TITLES[nav.route] || nav.route;
  }

  function renderContent() {
    switch (nav.route) {
      case '/dashboard':
        return <Overview onNavigate={navigate} />;

      case '/pos':
        return <Sale />;

      case '/products':
        return <ProductList onNavigate={navigate} />;
      case '/products/new':
        return <ProductForm onDone={() => navigate('/products')} onCancel={() => navigate('/products')} />;
      case '/products/edit':
        return (
          <ProductForm
            productId={nav.params.id}
            onDone={() => navigate('/products')}
            onCancel={() => navigate('/products')}
          />
        );
      case '/products/categories':
        return <CategoryList />;
      case '/products/low-stock':
        return <LowStock onNavigate={navigate} />;
      case '/products/dead-stock':
        return <DeadStock onNavigate={navigate} />;
      case '/products/bulk-import':
        return <BulkImport onNavigate={navigate} onDone={() => navigate('/products')} />;
      case '/products/purchases':
        return <PurchaseEntry />;
      case '/products/stock-adjustments':
        return <StockAdjustment productId={nav.params.productId} />;
      case '/products/stock-movements':
        return <MovementHistory productId={nav.params.productId} />;

      case '/customers':
        return <CustomerList onNavigate={navigate} />;
      case '/customers/new':
        return <CustomerForm onDone={() => navigate('/customers')} onCancel={() => navigate('/customers')} />;
      case '/customers/edit':
        return (
          <CustomerForm
            customerId={nav.params.id}
            onDone={() => navigate('/customers')}
            onCancel={() => navigate('/customers')}
          />
        );
      case '/customers/ledger':
        return <CustomerLedger onNavigate={navigate} />;
      case '/customers/ledger-view':
        return <CustomerLedger customerId={nav.params.id} onNavigate={navigate} />;
      case '/customers/categories':
        return <CategoryManager />;
      case '/customers/percentage-rules':
        return <PercentageRules />;

      case '/suppliers':
        return <SupplierList onNavigate={navigate} />;
      case '/suppliers/new':
        return <SupplierForm onDone={() => navigate('/suppliers')} onCancel={() => navigate('/suppliers')} />;
      case '/suppliers/edit':
        return (
          <SupplierForm
            supplierId={nav.params.id}
            onDone={() => navigate('/suppliers')}
            onCancel={() => navigate('/suppliers')}
          />
        );
      case '/suppliers/ledger':
        return <SupplierLedger onNavigate={navigate} />;
      case '/suppliers/ledger-view':
        return <SupplierLedger supplierId={nav.params.id} onNavigate={navigate} />;

      case '/payments/record':
        return <RecordPayment />;

      case '/users':
        return <UserList onNavigate={navigate} />;
      case '/users/new':
        return <UserForm onNavigate={navigate} onDone={() => navigate('/users')} />;
      case '/users/edit':
        return <UserForm userId={nav.params.id} onNavigate={navigate} onDone={() => navigate('/users')} />;
      case '/users/permissions':
        return <PermissionsManager initialUserId={nav.params.userId} />;

      case '/reports/sales':
        return <SalesReport initialDate={nav.params.date} />;
      case '/reports/profit-loss':
        return <ProfitLoss />;
      case '/reports/stock':
        return <StockReport />;
      case '/reports/customers':
        return <CustomerStatements onNavigate={navigate} />;
      case '/reports/suppliers':
        return <SupplierStatements />;
      case '/reports/cashiers':
        return <CashierPerformance />;
      case '/reports/expenses':
        return <ExpenseReport />;

      case '/settings/letterheads':
        return <Letterheads />;
      case '/settings/sync':
        return <SyncAndPcs />;

      default:
        return <PlaceholderPage title={ROUTE_TITLES[nav.route] || nav.route} />;
    }
  }

  return (
    <div style={styles.container}>
      <Sidebar
        activeRoute={nav.route}
        onNavigate={navigate}
        shopName={shopName}
        user={user}
        onLogout={logout}
      />

      <div style={styles.main}>
        <div style={styles.topbar}>
          <h2 style={styles.pageTitle}>{pageTitle()}</h2>
          <div style={styles.topbarRight}>
            <span>{today}</span>
            <span style={styles.divider}>|</span>
            <span>Logged in as {user.fullName}</span>
          </div>
        </div>

        <div style={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}

const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const styles = {
  container: { display: 'flex', height: '100vh', backgroundColor: theme.colors.appBackground, fontFamily: theme.font.family },
  main: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 28px',
    height: '56px',
    minHeight: '56px',
    backgroundColor: theme.colors.cardBackground,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  pageTitle: { color: theme.colors.textPrimary, fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold, margin: 0 },
  topbarRight: { display: 'flex', alignItems: 'center', gap: '10px', color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  divider: { color: theme.colors.border },
  content: { flex: 1, overflowY: 'auto', padding: '24px 28px' },
};
