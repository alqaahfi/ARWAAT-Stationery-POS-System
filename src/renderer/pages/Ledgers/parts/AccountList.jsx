import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, SearchX, Users } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Card, ChipGroup, DataTable, EmptyState, IconButton, SearchField, Select } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCurrency } from '../../../utils/format';
import { PartyNameCell, RowChevron, LoadError, NoMatch, ListSummary, listToolbar } from '../../Parties/PartyParts';

const c = theme.colors;

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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

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

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: isSupplier ? glossary.supplier : glossary.customer,
        render: (r) => (
          <PartyNameCell name={r.name} sub={[r.phone, r.mobile].filter(Boolean).join(' · ') || (isSupplier ? r.contact_person : undefined)} inactive={!r.is_active} />
        ),
      },
      ...(isSupplier
        ? []
        : [{ key: 'type', label: 'Type', width: '110px', render: (r) => (r.customer_type === 'wholesale' ? <Badge tone="purple">Wholesale</Badge> : <Badge tone="blue">Retail</Badge>) }]),
      { key: 'balance', label: 'Balance', numeric: true, width: '220px', render: (r) => <BalanceChip amount={r.balance_owed} party={party} /> },
      { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
    ],
    [isSupplier, party]
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

      <Card padding="0" style={{ overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          rows={visible}
          loading={loading}
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
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.sm }}>Pick an account to see everything that went on it.</div>
    </div>
  );
}
