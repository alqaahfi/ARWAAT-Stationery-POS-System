import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, SearchX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, Icon, useConfirm, useToast } from '../../components/ui';
import { computeRange } from '../Reports/components/DateRangePicker';
import { SalesToolbar } from './parts/SalesToolbar';
import { SalesTable, SummaryStrip } from './parts/SalesTable';
import { SaleDetailSheet } from './parts/SaleDetailSheet';
import QuickSaleOverlay from '../../components/billing/QuickSaleOverlay';
import useRememberedState from '../../utils/useRememberedState';

const c = theme.colors;
const PAGE_SIZE = 50;
const MAX_LOADED = 200;

const todayRange = () => ({ preset: 'today', ...computeRange('today') });

// Route: /sales. Read-only list of sales (cashiers see only their own —
// enforced by sales:list). params.saleId opens that sale's detail at once.
export default function SalesHistory({ onNavigate, saleId: initialSaleId }) {
  const { user, hasPermission } = useAuth();
  const isAdmin = user.role === 'admin';
  const canSell = hasPermission('make_sale');
  const confirm = useConfirm();
  const toast = useToast();

  const [searchInput, setSearchInput] = useRememberedState('salesHistory.searchInput', '');
  const [search, setSearch] = useRememberedState('salesHistory.search', '');
  const [range, setRange] = useRememberedState('salesHistory.range', todayRange);
  const [status, setStatus] = useRememberedState('salesHistory.status', 'all');
  const [saleType, setSaleType] = useRememberedState('salesHistory.saleType', 'all');
  const [cashierId, setCashierId] = useRememberedState('salesHistory.cashierId', '');
  const [cashiers, setCashiers] = useState([]);
  const [sortBy, setSortBy] = useRememberedState('salesHistory.sortBy', 'date');
  const [sortDir, setSortDir] = useRememberedState('salesHistory.sortDir', 'desc');
  const [newSaleOpen, setNewSaleOpen] = useState(false);

  const [result, setResult] = useState({ rows: [], total: 0, totals: { sumTotal: 0, sumBalanceDue: 0 }, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [anySales, setAnySales] = useState(true);
  const [openSaleId, setOpenSaleId] = useState(initialSaleId || null);

  const requestRef = useRef(0);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (isAdmin) window.api.users.list().then((rows) => setCashiers((rows || []).filter((r) => r.role === 'cashier'))).catch(() => {});
    return () => clearTimeout(debounceRef.current);
  }, [isAdmin]);

  // Admin: void any bill straight from the list (server re-checks everything).
  async function voidFromRow(row) {
    const ok = await confirm({
      title: `Void sale ${row.invoice_no}?`,
      message: 'Items go back to stock and the customer balance is corrected. The bill stays in history marked Voided and counts as zero everywhere.',
      confirmLabel: 'Void sale',
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await window.api.sales.void({ saleId: row.id, userId: user.id });
      if (res?.success) {
        toast.success(`Sale ${row.invoice_no} voided`);
        load();
      } else {
        toast.error(res?.reason || 'Could not void this sale.');
      }
    } catch {
      toast.error('Could not void this sale.');
    }
  }

  function onSearch(value) {
    setSearchInput(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(value.trim()), 300);
  }

  const buildQuery = useCallback(
    (offset) => ({
      requestingUserId: user.id,
      search,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      status: status === 'all' ? undefined : status,
      saleType: saleType === 'all' ? undefined : saleType,
      cashierId: isAdmin && cashierId ? Number(cashierId) : undefined,
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset,
    }),
    [user.id, search, range.dateFrom, range.dateTo, status, saleType, cashierId, isAdmin, sortBy, sortDir]
  );

  const load = useCallback(async () => {
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const res = await window.api.sales.list(buildQuery(0));
      if (id !== requestRef.current) return;
      if (!res?.success) throw new Error(res?.reason);
      setResult(res);
      if (res.total === 0) {
        // Tell "nothing at all yet" apart from "filters match nothing".
        const probe = await window.api.sales.list({ requestingUserId: user.id, limit: 1 });
        if (id === requestRef.current) setAnySales(!!probe?.total);
      } else {
        setAnySales(true);
      }
    } catch {
      if (id === requestRef.current) setError(true);
    }
    if (id === requestRef.current) setLoading(false);
  }, [buildQuery, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    const id = requestRef.current;
    setLoadingMore(true);
    try {
      const res = await window.api.sales.list(buildQuery(result.rows.length));
      if (id === requestRef.current && res?.success) {
        setResult((prev) => ({ ...res, rows: [...prev.rows, ...res.rows] }));
      }
    } catch {
      // The button stays; the user can try again.
    }
    setLoadingMore(false);
  }

  const filtersActive = !!search || status !== 'all' || saleType !== 'all' || !!cashierId;
  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearchInput('');
    setSearch('');
    setStatus('all');
    setSaleType('all');
    setCashierId('');
    setRange(todayRange());
  }

  function openCustomer(customer) {
    setOpenSaleId(null);
    onNavigate('/ledgers/customers', { id: customer.id, name: customer.name });
  }

  function goToReturns(params) {
    setOpenSaleId(null);
    onNavigate('/sales/returns', params);
  }

  const rows = result.rows;
  const capped = rows.length >= MAX_LOADED && result.hasMore;

  let content;
  if (error) {
    content = (
      <Card>
        <div role="alert" style={styles.error}>
          <Icon icon={CircleAlert} size={18} />
          <span style={{ flex: 1 }}>Couldn't load sales.</span>
          <Button size="sm" variant="tinted" onClick={load}>
            Try again
          </Button>
        </div>
      </Card>
    );
  } else if (!loading && rows.length === 0) {
    content = (
      <Card padding="0">
        {!anySales ? (
          <EmptyState
            {...appIcons.sales}
            title="No sales yet"
            message="Sales appear here as soon as you make one."
            action={canSell && <Button onClick={() => setNewSaleOpen(true)}>{glossary.newSale}</Button>}
            style={{ padding: '56px 24px' }}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={!filtersActive && range.preset === 'today' ? 'No sales today yet' : 'No sales match'}
            message={!filtersActive && range.preset === 'today' ? 'Pick a different date range to see earlier sales.' : 'Try a different date range or search.'}
            action={
              (filtersActive || range.preset !== 'today') && (
                <Button variant="tinted" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
            style={{ padding: '56px 24px' }}
          />
        )}
      </Card>
    );
  } else {
    content = (
      <>
        {!loading && <SummaryStrip total={result.total} totals={result.totals} />}
        <SalesTable rows={rows} isAdmin={isAdmin} loading={loading} onOpen={(r) => setOpenSaleId(r.id)} onVoid={isAdmin ? voidFromRow : undefined} />
        {!loading && result.hasMore && !capped && (
          <div style={styles.more}>
            <Button variant="plain" onClick={loadMore} loading={loadingMore}>
              Show more sales
            </Button>
          </div>
        )}
        {capped && <p style={styles.footnote}>Showing the newest {MAX_LOADED} sales. Narrow the dates to see older ones.</p>}
        <p style={styles.footnote}>
          Payment status shows how each sale was paid at the time. Later payments are on the customer's account.
          {isAdmin && (
            <Button variant="plain" size="sm" onClick={() => onNavigate('/ledgers/customers')} style={{ marginLeft: '4px' }}>
              Open {glossary.customerAccounts}
            </Button>
          )}
        </p>
      </>
    );
  }

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <p style={styles.intro}>
        {isAdmin ? 'Every sale made on your computers. Tap a sale to see its items or print it again.' : 'Sales you made.'}
      </p>
      <SalesToolbar
        search={searchInput}
        onSearch={onSearch}
        range={range}
        onRange={setRange}
        status={status}
        onStatus={setStatus}
        saleType={saleType}
        onSaleType={setSaleType}
        cashierId={cashierId}
        onCashier={setCashierId}
        cashiers={cashiers}
        isAdmin={isAdmin}
        sortBy={sortBy}
        onSortBy={setSortBy}
        sortDir={sortDir}
        onSortDir={setSortDir}
        onNewSale={canSell ? () => setNewSaleOpen(true) : undefined}
      />
      {content}
      <QuickSaleOverlay open={newSaleOpen} onSaved={() => load()} onClose={() => setNewSaleOpen(false)} />
      {openSaleId && (
        <SaleDetailSheet
          saleId={openSaleId}
          userId={user.id}
          isAdmin={isAdmin}
          onClose={() => setOpenSaleId(null)}
          onOpenCustomer={openCustomer}
          onReturnItems={isAdmin ? (id) => goToReturns({ saleId: id }) : undefined}
          onOpenReturn={isAdmin ? (id) => goToReturns({ returnId: id }) : undefined}
          onVoided={() => load()}
        />
      )}
    </div>
  );
}

const styles = {
  intro: { ...theme.type.subhead, color: c.labelSecondary, margin: `0 0 ${theme.spacing.md}` },
  more: { display: 'flex', justifyContent: 'center', marginTop: theme.spacing.smd },
  footnote: { ...theme.type.footnote, color: c.labelSecondary, margin: `${theme.spacing.smd} 0 0`, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  error: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: c.redText, ...theme.type.subhead },
};
