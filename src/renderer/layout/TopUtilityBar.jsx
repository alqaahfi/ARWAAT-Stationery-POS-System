import React, { useEffect, useRef, useState } from 'react';
import { Search, Bell, Plus, HelpCircle, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { formatCurrency } from '../utils/format';
import { STAGE_LABELS, getStageLegend, SALE_COMPLETED_EVENT } from '../pages/POS/Sale';

const REFRESH_INTERVAL_MS = 60000;

// Shared by every dropdown in this bar (search results, alerts, quick add,
// shortcuts) — closes it on any click that lands outside the given element.
function useClickOutside(ref, onOutside) {
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onOutside]);
}

// The slim bar above the main content area — same 48px/white/bottom-border
// pattern established by AdminDashboard's own topbar, which this replaces.
// Admin-only pieces (search, alerts, revenue, quick add) stay gated behind
// the same role check the rest of the app already uses for those modules;
// POS is gated behind the `make_sale` permission instead, same as the old
// Cashier Mode sidebar link it replaces — this bar surfaces nothing a
// cashier couldn't already reach elsewhere, it just doesn't currently render
// for cashiers at all since AdminDashboard itself is admin-only (kept gated
// anyway so it stays correct if that ever changes).
export default function TopUtilityBar({ pageTitle, activeRoute, onNavigate }) {
  const { user, hasPermission } = useAuth();
  const isAdmin = user.role === 'admin';
  const canSell = hasPermission('make_sale');

  const [syncStatus, setSyncStatus] = useState(null);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [deadStockCount, setDeadStockCount] = useState(0);
  const [aging90Count, setAging90Count] = useState(0);
  const [todayRevenue, setTodayRevenue] = useState(null);

  function refreshSync() {
    window.api.sync.getStatus().then(setSyncStatus);
  }

  function refreshAlerts() {
    if (!isAdmin) return;
    window.api.products.getLowStock().then((rows) => setLowStockCount(rows.length));
    window.api.products.getDeadStock().then((rows) => setDeadStockCount(rows.length));
    window.api.ledgers.getAgingReport().then((rows) => setAging90Count(rows.filter((r) => r.b90plus > 0).length));
  }

  function refreshRevenue() {
    if (!isAdmin) return;
    window.api.dashboard.getSummary().then((res) => setTodayRevenue(res.todaySalesTotal));
  }

  useEffect(() => {
    refreshSync();
    refreshAlerts();
    refreshRevenue();
    const interval = setInterval(() => {
      refreshSync();
      refreshAlerts();
      refreshRevenue();
    }, REFRESH_INTERVAL_MS);

    // A completed sale can move all three of these (queue depth, stock
    // levels, today's total) — refresh right away instead of waiting for
    // the next poll.
    function onSaleCompleted() {
      refreshSync();
      refreshAlerts();
      refreshRevenue();
    }
    window.addEventListener(SALE_COMPLETED_EVENT, onSaleCompleted);

    return () => {
      clearInterval(interval);
      window.removeEventListener(SALE_COMPLETED_EVENT, onSaleCompleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  return (
    <div style={styles.bar}>
      <h2 style={styles.pageTitle}>{pageTitle}</h2>

      {isAdmin && (
        <div style={styles.center}>
          <GlobalSearch onNavigate={onNavigate} />
        </div>
      )}

      <div style={styles.right}>
        {canSell && <PosButton active={activeRoute === '/pos'} onNavigate={onNavigate} />}
        <SyncStatusDot status={syncStatus} onNavigate={onNavigate} />
        <StationBadge status={syncStatus} />
        {isAdmin && <AlertsBell lowStockCount={lowStockCount} deadStockCount={deadStockCount} aging90Count={aging90Count} onNavigate={onNavigate} />}
        {isAdmin && <RevenueTicker amount={todayRevenue} />}
        {isAdmin && <QuickAddButton onNavigate={onNavigate} hasPermission={hasPermission} />}
        <ShortcutsHint />
      </div>
    </div>
  );
}

// ---------------- POS ----------------
// Replaces the old "Cashier Mode" sidebar link — same /pos route and same
// `make_sale` permission gate, just surfaced here as a one-click icon
// instead of a nav item, with visible text since it's a primary action, not
// a small utility icon like the ones next to it.

function PosButton({ active, onNavigate }) {
  return (
    <button style={{ ...styles.posButton, ...(active ? styles.posButtonActive : {}) }} onClick={() => onNavigate('/pos')} title="Cashier Mode">
      <ShoppingCart size={15} strokeWidth={1.75} />
      POS
    </button>
  );
}

// ---------------- Global Search ----------------

function GlobalSearch({ onNavigate }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null); // null = closed
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setResults(null));

  function handleChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await window.api.global.search({ query: value.trim() });
      setLoading(false);
      setResults(res);
    }, 250);
  }

  function selectProduct(p) {
    onNavigate('/products', { focusProductId: p.id });
    reset();
  }
  function selectCustomer(c) {
    onNavigate('/ledgers/customers', { id: c.id, name: c.name });
    reset();
  }
  function selectSupplier(s) {
    onNavigate('/ledgers/suppliers', { id: s.id, name: s.name });
    reset();
  }
  function reset() {
    setQuery('');
    setResults(null);
  }

  const hasAnyResults = results && (results.products.length || results.customers.length || results.suppliers.length);

  return (
    <div ref={containerRef} style={styles.searchWrap}>
      <Search size={15} color={theme.colors.textSecondary} style={styles.searchIcon} />
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search products, customers, suppliers…"
        style={styles.searchInput}
      />
      {results && (
        <div style={styles.dropdown}>
          {loading && <div style={styles.dropdownMessage}>Searching…</div>}
          {!loading && !hasAnyResults && <div style={styles.dropdownMessage}>No results.</div>}
          {!loading && results.products.length > 0 && (
            <ResultGroup title="Products">
              {results.products.map((p) => (
                <ResultRow key={`p-${p.id}`} onClick={() => selectProduct(p)}>
                  <span style={styles.resultName}>{p.name}</span>
                  <span style={styles.resultMeta}>{p.sku || p.category_name || ''}</span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}
          {!loading && results.customers.length > 0 && (
            <ResultGroup title="Customers">
              {results.customers.map((c) => (
                <ResultRow key={`c-${c.id}`} onClick={() => selectCustomer(c)}>
                  <span style={styles.resultName}>{c.name}</span>
                  <span style={{ ...styles.resultMeta, color: c.balance_owed > 0 ? theme.colors.danger : theme.colors.success }}>
                    {formatCurrency(c.balance_owed)}
                  </span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}
          {!loading && results.suppliers.length > 0 && (
            <ResultGroup title="Suppliers">
              {results.suppliers.map((s) => (
                <ResultRow key={`s-${s.id}`} onClick={() => selectSupplier(s)}>
                  <span style={styles.resultName}>{s.name}</span>
                  <span style={{ ...styles.resultMeta, color: s.balance_owed > 0 ? theme.colors.danger : theme.colors.success }}>
                    {formatCurrency(s.balance_owed)}
                  </span>
                </ResultRow>
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }) {
  return (
    <div>
      <div style={styles.groupHeader}>{title}</div>
      {children}
    </div>
  );
}

function ResultRow({ onClick, children }) {
  return (
    <div
      style={styles.resultRow}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = theme.colors.appBackground)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </div>
  );
}

// ---------------- Sync status dot ----------------

function syncDotColor(status) {
  if (!status) return theme.colors.border;
  if (status.lastSync && status.lastSync.status === 'failed') return theme.colors.danger;
  if (status.pendingCount > 0) return theme.colors.warning;
  return theme.colors.success;
}

function SyncStatusDot({ status, onNavigate }) {
  const color = syncDotColor(status);
  const title = !status
    ? 'Sync status loading…'
    : `${status.pendingCount} pending${status.lastSync ? ` · Last sync ${status.lastSync.status}` : ' · Never synced'}`;

  return (
    <button style={styles.iconBtn} onClick={() => onNavigate('/settings/sync')} title={title}>
      <span style={{ ...styles.syncDot, backgroundColor: color }} />
    </button>
  );
}

// ---------------- Station badge ----------------

function StationBadge({ status }) {
  const stationCode = status?.thisPc?.stationCode || 'MAIN';
  return <span style={styles.stationBadge}>{stationCode}</span>;
}

// ---------------- Alerts bell ----------------

function AlertsBell({ lowStockCount, deadStockCount, aging90Count, onNavigate }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false));

  const total = lowStockCount + deadStockCount + aging90Count;

  function go(route) {
    setOpen(false);
    onNavigate(route);
  }

  return (
    <div ref={containerRef} style={styles.dropdownAnchor}>
      <button style={styles.iconBtn} onClick={() => setOpen((o) => !o)} title="Alerts">
        <Bell size={17} color={theme.colors.textSecondary} strokeWidth={1.75} />
        {total > 0 && <span style={styles.badgeCount}>{total > 99 ? '99+' : total}</span>}
      </button>
      {open && (
        <div style={{ ...styles.dropdown, ...styles.dropdownRight }}>
          <AlertRow label="Low Stock" count={lowStockCount} onClick={() => go('/products/low-stock')} />
          <AlertRow label="Dead Stock" count={deadStockCount} onClick={() => go('/products/dead-stock')} />
          <AlertRow label="Customers 90+ Days Overdue" count={aging90Count} onClick={() => go('/ledgers/aging')} />
          {total === 0 && <div style={styles.dropdownMessage}>No alerts right now.</div>}
        </div>
      )}
    </div>
  );
}

function AlertRow({ label, count, onClick }) {
  if (count === 0) return null;
  return (
    <ResultRow onClick={onClick}>
      <span style={styles.resultName}>{label}</span>
      <span style={{ ...styles.resultMeta, color: theme.colors.warning, fontWeight: theme.font.weightSemibold }}>{count}</span>
    </ResultRow>
  );
}

// ---------------- Today's revenue ----------------

function RevenueTicker({ amount }) {
  return (
    <div style={styles.revenue} title="Today's revenue">
      <span style={styles.revenueLabel}>Today</span>
      <span style={styles.revenueValue}>{amount === null ? '…' : formatCurrency(amount)}</span>
    </div>
  );
}

// ---------------- Quick Add ----------------

// Add Product/Customer/Supplier go behind `admin` here since that's the
// same hard gate those forms enforce themselves (CustomerForm/SupplierForm
// directly; Products has no separate role concept of its own). Add Expense
// is the one exception — Expenses is permission-gated (`manage_expenses`),
// not a hard role, so it's checked the same way ExpenseList.jsx checks it.
const QUICK_ADD_ITEMS = [
  { label: 'Add Product', route: '/products/new', visible: () => true },
  { label: 'Add Customer', route: '/customers/new', visible: () => true },
  { label: 'Add Supplier', route: '/suppliers/new', visible: () => true },
  { label: 'Add Expense', route: '/expenses/new', visible: (hasPermission) => hasPermission('manage_expenses') },
];

function QuickAddButton({ onNavigate, hasPermission }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false));

  function go(route) {
    setOpen(false);
    onNavigate(route);
  }

  const items = QUICK_ADD_ITEMS.filter((item) => item.visible(hasPermission));
  if (items.length === 0) return null;

  return (
    <div ref={containerRef} style={styles.dropdownAnchor}>
      <button style={styles.iconBtn} onClick={() => setOpen((o) => !o)} title="Quick Add">
        <Plus size={17} color={theme.colors.textSecondary} strokeWidth={1.75} />
      </button>
      {open && (
        <div style={{ ...styles.dropdown, ...styles.dropdownRight, ...styles.quickAddDropdown }}>
          {items.map((item) => (
            <ResultRow key={item.route} onClick={() => go(item.route)}>
              <span style={styles.resultName}>{item.label}</span>
            </ResultRow>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Shortcuts hint ----------------

function ShortcutsHint() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  useClickOutside(containerRef, () => setOpen(false));

  return (
    <div ref={containerRef} style={styles.dropdownAnchor}>
      <button style={styles.iconBtn} onClick={() => setOpen((o) => !o)} title="Cashier Mode shortcuts">
        <HelpCircle size={17} color={theme.colors.textSecondary} strokeWidth={1.75} />
      </button>
      {open && (
        <div style={{ ...styles.dropdown, ...styles.dropdownRight, ...styles.shortcutsDropdown }}>
          <div style={styles.groupHeader}>Cashier Mode Shortcuts</div>
          {Object.keys(STAGE_LABELS).map((stage) => (
            <div key={stage} style={styles.shortcutRow}>
              <div style={styles.shortcutStage}>{STAGE_LABELS[stage]}</div>
              <div style={styles.shortcutKeys}>{getStageLegend(stage)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: '0 20px',
    height: '48px',
    minHeight: '48px',
    backgroundColor: theme.colors.cardBackground,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  pageTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeMd,
    fontWeight: theme.font.weightSemibold,
    margin: 0,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  center: { flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 },
  right: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },

  searchWrap: { position: 'relative', width: '100%', maxWidth: '420px' },
  searchIcon: { position: 'absolute', top: '50%', left: '10px', transform: 'translateY(-50%)' },
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '7px 10px 7px 32px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.appBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
    fontFamily: theme.font.family,
    outline: 'none',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    right: 0,
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.dropdown,
    maxHeight: '360px',
    overflowY: 'auto',
    zIndex: 60,
    padding: '6px',
  },
  dropdownRight: { left: 'auto', right: 0, width: '280px' },
  quickAddDropdown: { width: '180px' },
  shortcutsDropdown: { width: '360px', maxHeight: '420px' },
  dropdownMessage: { padding: '10px', color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, textAlign: 'center' },
  groupHeader: {
    padding: '6px 8px 4px',
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    fontWeight: theme.font.weightSemibold,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    borderRadius: theme.radius.sm,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  resultName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, flexShrink: 0 },

  iconBtn: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
  },
  posButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    fontSize: theme.font.sizeSm,
    fontWeight: theme.font.weightSemibold,
    fontFamily: theme.font.family,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  posButtonActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, color: theme.colors.primaryText },
  syncDot: { width: '9px', height: '9px', borderRadius: '50%' },
  stationBadge: {
    padding: '3px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.appBackground,
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    fontWeight: theme.font.weightMedium,
    whiteSpace: 'nowrap',
  },
  badgeCount: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    minWidth: '14px',
    height: '14px',
    padding: '0 3px',
    borderRadius: '7px',
    backgroundColor: theme.colors.danger,
    color: theme.colors.primaryText,
    fontSize: '10px',
    fontWeight: theme.font.weightSemibold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  dropdownAnchor: { position: 'relative' },
  revenue: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2, padding: '0 2px' },
  revenueLabel: { color: theme.colors.textSecondary, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  revenueValue: { color: theme.colors.success, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightSemibold },
  shortcutRow: { padding: '6px 8px', borderRadius: theme.radius.sm },
  shortcutStage: { color: theme.colors.textPrimary, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightMedium },
  shortcutKeys: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '2px' },
};
