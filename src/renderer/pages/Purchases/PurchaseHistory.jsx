import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, CircleAlert, Plus, SearchX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Button, Card, ChipGroup, EmptyState, Icon, IconButton, SearchField, Select } from '../../components/ui';
import { Lock } from 'lucide-react';
import { formatCount, formatCurrencyExact } from '../../utils/format';
import DateRangePicker, { computeRange } from '../Reports/components/DateRangePicker';
import QuickPurchaseOverlay from '../../components/billing/QuickPurchaseOverlay';
import { PurchaseTable } from './parts/PurchaseTable';
import { PurchaseDetailSheet } from './parts/PurchaseDetailSheet';

const c = theme.colors;
const PAGE_SIZE = 50;
const MAX_LOADED = 200;

const SORT_OPTIONS = [
  { key: 'date', label: 'Date' },
  { key: 'total', label: 'Total' },
  { key: 'due', label: 'Still owed' },
  { key: 'supplier', label: 'Supplier (A–Z)' },
  { key: 'reference', label: "Supplier's bill number" },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'paid', label: glossary.paid },
  { value: 'unpaid', label: 'Still owed' },
];

// Wide enough that a normal month of buying is on screen without touching the dates.
const defaultRange = () => ({ preset: 'this_year', ...computeRange('this_year') });

// Route: /products/purchases. Every purchase from suppliers, newest first,
// with search, sorting and a New Purchase button that opens the quick form
// right here. Admin only (also enforced by purchases:list).
export default function PurchaseHistory({ onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const [result, setResult] = useState({ rows: [], total: 0, totals: { sumTotal: 0, sumDue: 0 }, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [anyPurchases, setAnyPurchases] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState(null);

  const requestRef = useRef(0);
  const debounceRef = useRef(null);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

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
      sortBy,
      sortDir,
      limit: PAGE_SIZE,
      offset,
    }),
    [user.id, search, range.dateFrom, range.dateTo, status, sortBy, sortDir]
  );

  const load = useCallback(async () => {
    if (!isAdmin) return;
    const id = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const res = await window.api.purchases.list(buildQuery(0));
      if (id !== requestRef.current) return;
      if (!res?.success) throw new Error(res?.reason);
      setResult(res);
      if (res.total === 0) {
        const probe = await window.api.purchases.list({ requestingUserId: user.id, limit: 1 });
        if (id === requestRef.current) setAnyPurchases(!!probe?.total);
      } else {
        setAnyPurchases(true);
      }
    } catch {
      if (id === requestRef.current) setError(true);
    }
    if (id === requestRef.current) setLoading(false);
  }, [buildQuery, user.id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    const id = requestRef.current;
    setLoadingMore(true);
    try {
      const res = await window.api.purchases.list(buildQuery(result.rows.length));
      if (id === requestRef.current && res?.success) setResult((prev) => ({ ...res, rows: [...prev.rows, ...res.rows] }));
    } catch {
      // The button stays; try again.
    }
    setLoadingMore(false);
  }

  const filtersActive = !!search || status !== 'all';
  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearchInput('');
    setSearch('');
    setStatus('all');
    setRange(defaultRange());
  }

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState icon={Lock} title="Only the owner can see purchases" message="Ask the shop owner to sign in to review stock you bought." />
      </Card>
    );
  }

  const rows = result.rows;
  const capped = rows.length >= MAX_LOADED && result.hasMore;
  const newButton = (
    <Button icon={Plus} onClick={() => setNewOpen(true)}>
      {glossary.newPurchase}
    </Button>
  );

  let content;
  if (error) {
    content = (
      <Card>
        <div role="alert" style={styles.error}>
          <Icon icon={CircleAlert} size={18} />
          <span style={{ flex: 1 }}>Couldn't load purchases.</span>
          <Button size="sm" variant="tinted" onClick={load}>
            Try again
          </Button>
        </div>
      </Card>
    );
  } else if (!loading && rows.length === 0) {
    content = (
      <Card padding="0">
        {!anyPurchases ? (
          <EmptyState
            {...appIcons.purchases}
            title="No purchases yet"
            message="Record the stock you buy from suppliers and it will be listed here."
            action={newButton}
            style={{ padding: '56px 24px' }}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="No purchases match"
            message="Try a different date range or search."
            action={
              <Button variant="tinted" onClick={clearFilters}>
                Clear filters
              </Button>
            }
            style={{ padding: '56px 24px' }}
          />
        )}
      </Card>
    );
  } else {
    content = (
      <>
        {!loading && (
          <Card padding="10px 16px" style={{ marginBottom: theme.spacing.smd }}>
            <div style={styles.summary}>
              {[
                `${formatCount(result.total)} ${result.total === 1 ? 'purchase' : 'purchases'}`,
                `${formatCurrencyExact(result.totals.sumTotal)} bought`,
                result.totals.sumDue > 0.005 ? `${formatCurrencyExact(result.totals.sumDue)} still owed on these` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </Card>
        )}
        <PurchaseTable rows={rows} loading={loading} onOpen={(r) => setOpenId(r.id)} />
        {!loading && result.hasMore && !capped && (
          <div style={styles.more}>
            <Button variant="plain" onClick={loadMore} loading={loadingMore}>
              Show more purchases
            </Button>
          </div>
        )}
        {capped && <p style={styles.footnote}>Showing the newest {MAX_LOADED} purchases. Narrow the dates to see older ones.</p>}
        <p style={styles.footnote}>
          "Still owed" is what was left unpaid when the purchase was saved. Later payments are on the supplier's account.
          <Button variant="plain" size="sm" onClick={() => onNavigate('/ledgers/suppliers')} style={{ marginLeft: '4px' }}>
            Open {glossary.supplierAccounts}
          </Button>
        </p>
      </>
    );
  }

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <p style={styles.intro}>Every purchase from your suppliers. Tap one to see what was bought.</p>
      <div style={styles.toolbar}>
        <div style={styles.row}>
          <SearchField
            value={searchInput}
            onChange={onSearch}
            placeholder="Search supplier, phone or bill number"
            aria-label="Search purchases"
            style={{ flex: '1 1 280px', minWidth: '240px', maxWidth: '420px' }}
          />
          <ChipGroup options={STATUS_OPTIONS} value={status} onChange={setStatus} size="sm" aria-label="Payment" />
        </div>
        <div style={styles.row}>
          <DateRangePicker value={range} onChange={setRange} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <Select aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '220px' }}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  Sort: {o.label}
                </option>
              ))}
            </Select>
            <IconButton
              icon={sortDir === 'asc' ? ArrowUp : ArrowDown}
              label={sortDir === 'asc' ? 'Sorted low to high — click to reverse' : 'Sorted high to low — click to reverse'}
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
            />
          </div>
          <div style={{ marginLeft: 'auto' }}>{newButton}</div>
        </div>
      </div>

      {content}

      <QuickPurchaseOverlay open={newOpen} onSaved={() => load()} onClose={() => setNewOpen(false)} />
      {openId && (
        <PurchaseDetailSheet
          purchaseId={openId}
          userId={user.id}
          onClose={() => setOpenId(null)}
          onOpenSupplier={(s) => {
            setOpenId(null);
            onNavigate('/suppliers/edit', { id: s.id, name: s.name });
          }}
        />
      )}
    </div>
  );
}

const styles = {
  intro: { ...theme.type.subhead, color: c.labelSecondary, margin: `0 0 ${theme.spacing.md}` },
  toolbar: { display: 'flex', flexDirection: 'column', gap: theme.spacing.smd, marginBottom: theme.spacing.md },
  row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
  summary: { ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary },
  more: { display: 'flex', justifyContent: 'center', marginTop: theme.spacing.smd },
  footnote: { ...theme.type.footnote, color: c.labelSecondary, margin: `${theme.spacing.smd} 0 0`, display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
  error: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: c.redText, ...theme.type.subhead },
};
