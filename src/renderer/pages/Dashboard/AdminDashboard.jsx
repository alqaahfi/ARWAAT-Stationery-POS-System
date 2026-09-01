import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Sidebar, { SIDEBAR_WIDTH } from '../../layout/Sidebar';
import TopUtilityBar from '../../layout/TopUtilityBar';
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
import Sale, { isPosSaleInProgress } from '../POS/Sale';
import CustomerList from '../Customers/CustomerList';
import CustomerForm from '../Customers/CustomerForm';
import CategoryManager from '../Customers/CategoryManager';
import PercentageRules from '../Customers/PercentageRules';
import SupplierList from '../Suppliers/SupplierList';
import SupplierForm from '../Suppliers/SupplierForm';
import LedgersOverview from '../Ledgers/Overview';
import CustomerLedger from '../Ledgers/CustomerLedger';
import SupplierLedger from '../Ledgers/SupplierLedger';
import PaymentHistory from '../Ledgers/PaymentHistory';
import AdvancesAndCredits from '../Ledgers/AdvancesAndCredits';
import AgingReport from '../Ledgers/AgingReport';
import LedgerAdjustments from '../Ledgers/Adjustments';
import RecordPayment from '../Payments/RecordPayment';
import ExpenseList from '../Expenses/ExpenseList';
import ExpenseForm from '../Expenses/ExpenseForm';
import ExpenseCategories from '../Expenses/ExpenseCategories';
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
import ShopInfo from '../Settings/ShopInfo';
import PrinterSettings from '../Settings/PrinterSettings';
import BackupRestore from '../Settings/BackupRestore';
import LicenseInfo from '../Settings/LicenseInfo';
import Preferences from '../Settings/Preferences';
import theme from '../../config/theme';

// Simple state-based router (no react-router in this project): `nav.route`
// matches a navConfig route string, `nav.params` carries anything a fixed
// sidebar link can't (e.g. which product id to edit).
export default function AdminDashboard({ shopName }) {
  const { user, logout } = useAuth();
  const [nav, setNav] = useState({ route: '/dashboard', params: {} });

  function navigate(route, params = {}) {
    // Leaving Cashier Mode mid-sale (cart has items) would otherwise silently
    // discard it — Sale.jsx registers whether that's currently true so this
    // router can guard the one route that needs it, without every page
    // needing its own leave-confirmation wiring.
    if (nav.route === '/pos' && route !== '/pos' && isPosSaleInProgress()) {
      const proceed = window.confirm("You have an unfinished sale — leave anyway? It'll be saved as a draft.");
      if (!proceed) return;
    }
    setNav({ route, params });
  }

  function pageTitle() {
    // No longer a navConfig entry (Cashier Mode moved to the top utility
    // bar's POS icon), so ROUTE_TITLES has nothing for '/pos' — set here.
    if (nav.route === '/pos') return 'Cashier Mode';
    if (nav.route === '/products/edit') return nav.params.id ? 'Edit Product' : 'Add New Product';
    if (nav.route === '/customers/edit') return 'Edit Customer';
    if (nav.route === '/suppliers/edit') return 'Edit Supplier';
    if (nav.route === '/ledgers/customers') return nav.params.name ? `Ledger — ${nav.params.name}` : 'Customer Ledger';
    if (nav.route === '/ledgers/suppliers') return nav.params.name ? `Ledger — ${nav.params.name}` : 'Supplier Ledger';
    if (nav.route === '/expenses/edit') return 'Edit Expense';
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
        return <ProductList onNavigate={navigate} focusProductId={nav.params.focusProductId} />;
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
      case '/ledgers':
        return <LedgersOverview onNavigate={navigate} />;
      case '/ledgers/customers':
        return <CustomerLedger customerId={nav.params.id} onNavigate={navigate} />;
      case '/ledgers/suppliers':
        return <SupplierLedger supplierId={nav.params.id} onNavigate={navigate} />;
      case '/ledgers/payments':
        return <PaymentHistory onNavigate={navigate} />;
      case '/ledgers/advances':
        return <AdvancesAndCredits onNavigate={navigate} />;
      case '/ledgers/aging':
        return <AgingReport onNavigate={navigate} />;
      case '/ledgers/adjustments':
        return <LedgerAdjustments />;

      case '/payments/record':
        return <RecordPayment />;

      case '/expenses':
        return <ExpenseList onNavigate={navigate} />;
      case '/expenses/new':
        return <ExpenseForm onDone={() => navigate('/expenses')} onCancel={() => navigate('/expenses')} />;
      case '/expenses/edit':
        return (
          <ExpenseForm expenseId={nav.params.id} onDone={() => navigate('/expenses')} onCancel={() => navigate('/expenses')} />
        );
      case '/expenses/categories':
        return <ExpenseCategories onNavigate={navigate} />;

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

      case '/settings/shop':
        return <ShopInfo />;
      case '/settings/letterheads':
        return <Letterheads />;
      case '/settings/printers':
        return <PrinterSettings />;
      case '/settings/sync':
        return <SyncAndPcs />;
      case '/settings/backup':
        return <BackupRestore />;
      case '/settings/license':
        return <LicenseInfo />;
      case '/settings/preferences':
        return <Preferences />;

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
        <TopUtilityBar pageTitle={pageTitle()} activeRoute={nav.route} onNavigate={navigate} />

        <div style={styles.content}>{renderContent()}</div>
      </div>
    </div>
  );
}

// Sidebar is `position: fixed` and always fully open at a steady width —
// main content's margin-left matches that width so it never sits underneath it.
const styles = {
  container: { height: '100vh', backgroundColor: theme.colors.appBackground, fontFamily: theme.font.family },
  main: {
    marginLeft: SIDEBAR_WIDTH,
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  content: { flex: 1, overflowY: 'auto', padding: '24px 28px' },
};
