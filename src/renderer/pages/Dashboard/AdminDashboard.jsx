import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { restoreScroll } from '../../utils/scrollRestore';
import { useAuth } from '../../context/AuthContext';
import Sidebar from '../../layout/Sidebar';
import TopUtilityBar from '../../layout/TopUtilityBar';
import SectionTabs from '../../layout/SectionTabs';
import SearchPalette from '../../layout/SearchPalette';
import { ROUTE_TITLES, getSectionForRoute } from '../../config/navConfig';
import glossary from '../../config/glossary';
import PlaceholderPage from '../../components/PlaceholderPage';
import Overview from './Overview';
import CategoryList from '../Products/CategoryList';
import ProductList from '../Products/ProductList';
import ProductForm from '../Products/ProductForm';
import LowStock from '../Products/LowStock';
import DeadStock from '../Products/DeadStock';
import BulkImport from '../Products/BulkImport';
import PurchaseHistory from '../Purchases/PurchaseHistory';
import ProductProfile from '../Products/ProductProfile';
import StockList from '../Stock/StockList';
import StockHistory from '../Stock/StockHistory';
import CustomerProfile from '../Customers/CustomerProfile';
import SupplierProfile from '../Suppliers/SupplierProfile';
import Sale, { isPosSaleInProgress } from '../POS/Sale';
import CustomerList from '../Customers/CustomerList';
import CustomerForm from '../Customers/CustomerForm';
import SupplierList from '../Suppliers/SupplierList';
import SupplierForm from '../Suppliers/SupplierForm';
import LedgersHome from '../Ledgers/LedgersHome';
import LedgersMore, { MoreSubPage } from '../Ledgers/LedgersMore';
import CustomerLedger from '../Ledgers/CustomerLedger';
import SupplierLedger from '../Ledgers/SupplierLedger';
import PaymentHistory from '../Ledgers/PaymentHistory';
import AdvancesAndCredits from '../Ledgers/AdvancesAndCredits';
import AgingReport from '../Ledgers/AgingReport';
import LedgerAdjustments from '../Ledgers/Adjustments';
import RecordPayment from '../Payments/RecordPayment';
import SalesHistory from '../Sales/SalesHistory';
import Returns from '../Sales/Returns';
import ExpenseList from '../Expenses/ExpenseList';
import ExpenseForm from '../Expenses/ExpenseForm';
import CashierList from '../Users/CashierList';
import CashierForm from '../Users/CashierForm';
import CashierSessions from '../Users/CashierSessions';
import SessionDetail from '../Users/SessionDetail';
import SalesReport from '../Reports/SalesReport';
import ProfitLoss from '../Reports/ProfitLoss';
import StockReport from '../Reports/StockReport';
import CustomerStatements from '../Reports/CustomerStatements';
import SupplierStatements from '../Reports/SupplierStatements';
import CashierPerformance from '../Reports/CashierPerformance';
import ExpenseReport from '../Reports/ExpenseReport';
import ReportsHome from '../Reports/ReportsHome';
import Letterheads from '../Settings/Letterheads';
import SyncAndPcs from '../Settings/SyncAndPcs';
import ReceiptContent from '../Settings/ReceiptContent';
import PrinterSettings from '../Settings/PrinterSettings';
import BackupRestore from '../Settings/BackupRestore';
import LicenseInfo from '../Settings/LicenseInfo';
import Preferences from '../Settings/Preferences';
import theme from '../../config/theme';

// Dev-only design reference (Ctrl+Shift+G). The DEV guard lets Vite drop the
// import entirely from production builds.
const DesignGallery = import.meta.env.DEV ? lazy(() => import('../Dev/DesignGallery')) : null;

// Simple state-based router (no react-router in this project): `nav.route`
// matches a navConfig route string, `nav.params` carries anything a fixed
// sidebar link can't (e.g. which product id to edit).
export default function AdminDashboard() {
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
    // Remember where this page was scrolled; coming back to it from one of its
    // own detail pages (same section) puts it back there.
    const from = getSectionForRoute(nav.route);
    const to = getSectionForRoute(route);
    scrollMemory.current[nav.route] = mainRef.current?.scrollTop || 0;
    restoreTarget.current = from?.page && to && from.section === to.section ? scrollMemory.current[route] || 0 : 0;
    setNav({ route, params });
  }

  const mainRef = useRef(null);
  const scrollMemory = useRef({});
  const restoreTarget = useRef(0);
  useLayoutEffect(() => {
    const top = restoreTarget.current;
    restoreTarget.current = 0;
    if (!top) return undefined;
    return restoreScroll(mainRef.current, top);
  }, [nav.route]);

  const [searchOpen, setSearchOpen] = useState(false);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  useEffect(() => {
    function onKey(e) {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      if (DesignGallery && e.shiftKey && key === 'g') {
        e.preventDefault();
        navigateRef.current('/dev/design-gallery');
      } else if (!e.shiftKey && key === 'k') {
        // Leave the shortcut alone while a modal or confirm is up.
        if (document.querySelector('[aria-modal="true"]:not([data-search-palette] *)')) return;
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Tab routes and standalone pages show the section name; forms and detail
  // pages show their own title plus a "‹ Section" back button.
  const match = getSectionForRoute(nav.route);
  const back = match?.page ? { label: match.section.label, route: match.section.route } : null;

  function pageTitle() {
    if (nav.route === '/pos') return glossary.newSale;
    if (import.meta.env.DEV && nav.route === '/dev/design-gallery') return 'Design Gallery';
    if (nav.route === '/products/edit') return nav.params.id ? glossary.editProduct : glossary.addProduct;
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
      case '/products/profile':
        return <ProductProfile key={nav.params.id} productId={nav.params.id} onNavigate={navigate} />;
      case '/stock':
        return <StockList onNavigate={navigate} />;
      case '/stock/history':
        return <StockHistory productId={nav.params.productId} />;
      case '/products/new':
        return <ProductForm onDone={() => navigate('/products')} onCancel={() => navigate('/products')} />;
      case '/products/edit':
        return (
          <ProductForm
            productId={nav.params.id}
            onNavigate={navigate}
            onDone={() => navigate('/products/profile', { id: nav.params.id })}
            onCancel={() => navigate('/products/profile', { id: nav.params.id })}
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
        return <PurchaseHistory onNavigate={navigate} />;

      case '/customers':
        return <CustomerList onNavigate={navigate} />;
      case '/customers/new':
        return <CustomerForm onDone={() => navigate('/customers')} onCancel={() => navigate('/customers')} />;
      case '/customers/profile':
        return <CustomerProfile key={nav.params.id} customerId={nav.params.id} onNavigate={navigate} />;
      case '/customers/edit':
        return (
          <CustomerForm
            customerId={nav.params.id}
            onNavigate={navigate}
            onDone={() => navigate('/customers/profile', { id: nav.params.id })}
            onCancel={() => navigate('/customers/profile', { id: nav.params.id })}
          />
        );

      case '/suppliers':
        return <SupplierList onNavigate={navigate} />;
      case '/suppliers/new':
        return <SupplierForm onDone={() => navigate('/suppliers')} onCancel={() => navigate('/suppliers')} />;
      case '/suppliers/profile':
        return <SupplierProfile key={nav.params.id} supplierId={nav.params.id} onNavigate={navigate} />;
      case '/suppliers/edit':
        return (
          <SupplierForm
            supplierId={nav.params.id}
            onNavigate={navigate}
            onDone={() => navigate('/suppliers/profile', { id: nav.params.id })}
            onCancel={() => navigate('/suppliers/profile', { id: nav.params.id })}
          />
        );
      case '/ledgers':
        return <LedgersHome onNavigate={navigate} />;
      case '/ledgers/customers':
        return <CustomerLedger customerId={nav.params.id} onNavigate={navigate} />;
      case '/ledgers/suppliers':
        return <SupplierLedger supplierId={nav.params.id} onNavigate={navigate} />;
      case '/ledgers/more':
        return <LedgersMore onNavigate={navigate} />;
      case '/ledgers/payments':
        return <MoreSubPage route={nav.route} onNavigate={navigate}><PaymentHistory onNavigate={navigate} /></MoreSubPage>;
      case '/ledgers/advances':
        return <MoreSubPage route={nav.route} onNavigate={navigate}><AdvancesAndCredits onNavigate={navigate} /></MoreSubPage>;
      case '/ledgers/aging':
        return <MoreSubPage route={nav.route} onNavigate={navigate}><AgingReport onNavigate={navigate} /></MoreSubPage>;
      case '/ledgers/adjustments':
        return <MoreSubPage route={nav.route} onNavigate={navigate}><LedgerAdjustments /></MoreSubPage>;

      case '/sales':
        return <SalesHistory onNavigate={navigate} saleId={nav.params.saleId} />;
      case '/sales/returns':
        return <Returns key={`${nav.params.saleId || ''}-${nav.params.returnId || ''}`} params={nav.params} onNavigate={navigate} />;

      case '/payments/record':
        return <RecordPayment params={nav.params} onNavigate={navigate} />;

      case '/expenses':
        return <ExpenseList onNavigate={navigate} />;
      case '/expenses/new':
        return <ExpenseForm onDone={() => navigate('/expenses')} onCancel={() => navigate('/expenses')} />;
      case '/expenses/edit':
        return (
          <ExpenseForm expenseId={nav.params.id} onDone={() => navigate('/expenses')} onCancel={() => navigate('/expenses')} />
        );

      case '/cashiers':
        return <CashierList onNavigate={navigate} />;
      case '/cashiers/new':
        return <CashierForm onDone={() => navigate('/cashiers')} onCancel={() => navigate('/cashiers')} />;
      case '/cashiers/edit':
        return <CashierForm cashierId={nav.params.id} onDone={() => navigate('/cashiers')} onCancel={() => navigate('/cashiers')} />;
      case '/cashiers/sessions':
        return <CashierSessions onNavigate={navigate} />;
      case '/cashiers/sessions/detail':
        return <SessionDetail sessionId={nav.params.id} onNavigate={navigate} />;

      case '/reports':
        return <ReportsHome onNavigate={navigate} />;
      case '/reports/sales':
        return <SalesReport initialDate={nav.params.date} />;
      case '/reports/profit-loss':
        return <ProfitLoss />;
      case '/reports/stock':
        return <StockReport />;
      case '/reports/customers':
        return <CustomerStatements onNavigate={navigate} />;
      case '/reports/suppliers':
        return <SupplierStatements onNavigate={navigate} />;
      case '/reports/cashiers':
        return <CashierPerformance />;
      case '/reports/expenses':
        return <ExpenseReport />;

      case '/settings/receipt-content':
        return <ReceiptContent />;
      case '/settings/letterheads':
        return <Letterheads />;
      case '/settings/printers':
        return <PrinterSettings />;
      case '/settings/sync':
        return <SyncAndPcs onNavigate={navigate} />;
      case '/settings/backup':
        return <BackupRestore />;
      case '/settings/license':
        return <LicenseInfo />;
      case '/settings/preferences':
        return <Preferences />;

      case '/dev/design-gallery':
        if (!DesignGallery) return <PlaceholderPage title={nav.route} />;
        return (
          <Suspense fallback={null}>
            <DesignGallery />
          </Suspense>
        );

      default:
        return <PlaceholderPage title={ROUTE_TITLES[nav.route] || nav.route} />;
    }
  }

  return (
    <div style={styles.container}>
      <Sidebar activeRoute={nav.route} onNavigate={navigate} user={user} onLogout={logout} />

      <div style={styles.main}>
        <TopUtilityBar title={pageTitle()} back={back} onNavigate={navigate} onOpenSearch={() => setSearchOpen(true)} />

        <main ref={mainRef} style={nav.route === '/pos' ? styles.posContent : styles.content}>
          <SectionTabs route={nav.route} onNavigate={navigate} />
          {renderContent()}
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={navigate} />
    </div>
  );
}

// Only the content region scrolls; sidebar and top bar stay put.
const styles = {
  container: { display: 'flex', height: '100vh', overflow: 'hidden', backgroundColor: theme.colors.bg, fontFamily: theme.font.family },
  main: { flex: 1, minWidth: 0, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, minHeight: 0, overflowY: 'auto', padding: theme.spacing.lg, backgroundColor: theme.colors.bg },
  // New Sale fills the region itself; only its own lists scroll.
  posContent: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: theme.spacing.md, backgroundColor: theme.colors.bg },
};
