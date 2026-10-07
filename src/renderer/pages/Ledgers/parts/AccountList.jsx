import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, SearchX, Users } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Card, ChipGroup, DataTable, EmptyState, IconButton, SearchField, Select } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCurrency } from '../../../utils/format';
import { PartyNameCell, RowChevron, LoadError, NoMatch, ListSummary, listToolbar } from '../../Parties/PartyParts';
import { PartyCards, PartyViewToggle, usePartyViewMode } from '../../Parties/PartyViews';
import { TypeBadge } from '../../Customers/parts/CustomerListParts';
import useRememberedState from '../../../utils/useRememberedState';

const c = theme.colors;

const accountSubline = (r, isSupplier) => [r.phone, r.mobile].filter(Boolean).join(' · ') || (isSupplier ? r.contact_person : undefined) || undefined;

const SORTS = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'balance', label: 'Balance' },
  { key: 'phone', label: 'Phone' },
];

// The front door of Customer Accounts and Supplier Accounts: every account in
// one searchable, sortable list. Picking one opens its full timeline.
export default function AccountList({ party, onPick }) {
  const isSupplier = party === 'supplier';
  const noun = isSupplier ? 'supplier' : 'customer';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useRememberedState(`accounts.${party}.search`, '');
  const [filter, setFilter] = useRememberedState(`accounts.${party}.filter`, 'all');
  const [sortBy, setSortBy] = useRememberedState(`accounts.${party}.sortBy`, 'name');
  const [sortDir, setSortDir] = useRememberedState(`accounts.${party}.sortDir`, 'asc');
  const [viewMode, setViewMode] = usePartyViewMode(isSupplier ? 'pos_supplier_account_view_mode' : 'pos_customer_account_view_mode');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const api = isSupplier ? window.api.suppliers : window.api.customers;
      setRows((await api.list({})) || []);
    } catch {
      setFailed(true);
    }
    setLoading(false);
  }, [isSupplier]);

  useEffect(() => {
    setSearch('');
    setFilter('all');
    load();
  }, [load]);

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'owed', label: isSupplier ? 'You owe' : 'Owe you' },
    { value: 'credit', label: 'Paid in advance' },
    { value: 'settled', label: 'Settled' },
  ];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bal = (r) => Number(r.balance_owed) || 0;
    let list = rows.filter((r) => {
      if (q && !`${r.name} ${r.phone || ''} ${r.mobile || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'owed') return bal(r) > 0.005;
      if (filter === 'credit') return bal(r) < -0.005;
      if (filter === 'settled') return Math.abs(bal(r)) <= 0.005;
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (sortBy === 'balance') return (bal(a) - bal(b)) * dir;
      if (sortBy === 'phone') return String(a.phone || a.mobile || '').localeCompare(String(b.phone || b.mobile || '')) * dir;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) * dir;
    });
    return list;
  }, [rows, search, filter, sortBy, sortDir]);

  const totalOwed = useMemo(() => visible.reduce((sum, r) => (Number(r.balance_owed) > 0 ? sum + Number(r.balance_owed) : sum), 0), [visible]);

  const compact = viewMode === 'compact';
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: isSupplier ? glossary.supplier : glossary.customer,
        render: compact
          ? (r) => <span style={{ fontWeight: theme.font.weightSemibold, opacity: r.is_active ? 1 : 0.6 }}>{r.name}</span>
          : (r) => <PartyNameCell name={r.name} sub={accountSubline(r, isSupplier)} inactive={!r.is_active} />,
      },
      ...(isSupplier ? [] : [{ key: 'type', label: 'Type', width: '110px', render: (r) => <TypeBadge type={r.customer_type} /> }]),
      { key: 'balance', label: 'Balance', numeric: true, width: '220px', render: (r) => <BalanceChip amount={r.balance_owed} party={party} /> },
      { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
    ],
    [isSupplier, party, compact]
  );

  function clearFilters() {
    setSearch('');
    setFilter('all');
  }

  if (failed) {
    return (
      <Card padding="0">
        <LoadError message={`The ${noun} accounts couldn't be loaded.`} onRetry={load} />
      </Card>
    );
  }

  const filtered = !!search.trim() || filter !== 'all';
  return (
    <div>
      <div style={listToolbar}>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search by name or phone"
          aria-label={`Search ${noun} accounts`}
          style={{ flex: '1 1 220px', maxWidth: '420px' }}
        />
        <ChipGroup options={filterOptions} value={filter} onChange={setFilter} size="sm" aria-label="Show accounts" />
        <PartyViewToggle value={viewMode} onChange={setViewMode} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
          <Select aria-label="Sort by" value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '180px' }}>
            {SORTS.map((o) => (
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
      </div>

      <ListSummary>
        {loading
          ? 'Loading…'
          : `${visible.length} ${noun} account${visible.length === 1 ? '' : 's'}${
              totalOwed > 0 ? ` · ${isSupplier ? `You owe ${formatCurrency(totalOwed)}` : `${formatCurrency(totalOwed)} owed to you`}` : ''
            }`}
      </ListSummary>

      {viewMode === 'grid' && !loading && visible.length > 0 ? (
        <PartyCards
          rows={visible}
          party={party}
          badges={isSupplier ? undefined : (r) => <TypeBadge type={r.customer_type} />}
          subline={(r) => accountSubline(r, isSupplier)}
          onOpen={onPick}
        />
      ) : (
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={visible}
            loading={loading}
            dense={compact}
            onRowClick={onPick}
            emptyState={
              filtered ? (
                <NoMatch what={`${noun} accounts`} onClear={clearFilters} />
              ) : (
                <EmptyState icon={isSupplier ? SearchX : Users} title={`No ${noun}s yet`} message={`Add a ${noun} first, then their account shows up here.`} />
              )
            }
          />
        </Card>
      )}
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.sm }}>Pick an account to see everything that went on it.</div>
    </div>
  );
}
