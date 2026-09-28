import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import { CustomerToolbar, NoCustomers, customerColumns } from './parts/CustomerListParts';
import { ListSummary, LoadError, NoMatch, RestrictedNotice } from '../Parties/PartyParts';

export default function CustomerList({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();

  const [customers, setCustomers] = useState([]);
  const [tierFilter, setTierFilter] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const debounceRef = useRef(null);
  const searchRef = useRef('');
  const requestRef = useRef(0);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const req = ++requestRef.current;
      if (!silent) setLoading(true);
      try {
        const rows = await window.api.customers.list({
          search: searchRef.current,
          tier: tierFilter || null,
          customerType: typeFilter || null,
        });
        if (req !== requestRef.current) return;
        setCustomers(rows || []);
        setLoadFailed(false);
      } catch {
        if (req === requestRef.current) setLoadFailed(true);
      } finally {
        if (req === requestRef.current) setLoading(false);
      }
    },
    [tierFilter, typeFilter]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleSearchChange(value) {
    setSearch(value);
    searchRef.current = value;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(), 250);
  }

  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearch('');
    searchRef.current = '';
    const unchanged = !tierFilter && !typeFilter;
    setTierFilter('');
    setTypeFilter('');
    if (unchanged) load();
  }

  const toggleActive = useCallback(
    async (c) => {
      const next = c.is_active ? 0 : 1;
      setCustomers((list) => list.map((row) => (row.id === c.id ? { ...row, is_active: next } : row)));
      try {
        await window.api.customers.setActive({ id: c.id, isActive: next });
        toast.success(next ? `${c.name} is active again` : `${c.name} is now inactive`);
      } catch {
        toast.error("Couldn't change that. Please try again.");
      }
      load({ silent: true });
    },
    [load, toast]
  );

  const columns = useMemo(() => customerColumns({ onToggleActive: toggleActive }), [toggleActive]);

  const summary = useMemo(() => {
    const owed = customers.reduce((sum, c) => (Number(c.balance_owed) > 0 ? sum + Number(c.balance_owed) : sum), 0);
    const hasBalances = customers.some((c) => c.balance_owed !== undefined);
    return { count: customers.length, owed, hasBalances };
  }, [customers]);

  // Hard role gate — Customers is admin-only regardless of the permission
  // system. Sidebar already never renders this route for a cashier, but this
  // page defends itself too in case it's ever reached directly. All hooks
  // above run unconditionally every render; this check only decides the
  // returned JSX.
  if (user.role !== 'admin') {
    return <RestrictedNotice />;
  }

  const filtered = !!(search.trim() || tierFilter || typeFilter);
  const goAdd = () => onNavigate('/customers/new');

  return (
    <div style={{ paddingBottom: '48px' }}>
      <CustomerToolbar
        search={search}
        onSearch={handleSearchChange}
        typeFilter={typeFilter}
        onTypeFilter={setTypeFilter}
        tierFilter={tierFilter}
        onTierFilter={setTierFilter}
        onAdd={goAdd}
      />

      <ListSummary>
        {loading
          ? 'Loading…'
          : `${summary.count} customer${summary.count === 1 ? '' : 's'}${
              summary.hasBalances && summary.owed > 0 ? ` · ${formatCurrency(summary.owed)} owed to you in total` : ''
            }`}
      </ListSummary>

      <Card padding="0" style={{ overflow: 'hidden' }}>
        {loadFailed ? (
          <LoadError message="The customer list couldn't be loaded." onRetry={() => load()} />
        ) : (
          <DataTable
            columns={columns}
            rows={customers}
            loading={loading}
            onRowClick={(c) => onNavigate('/customers/edit', { id: c.id })}
            emptyState={filtered ? <NoMatch what="customers" onClear={clearFilters} /> : <NoCustomers onAdd={goAdd} />}
          />
        )}
      </Card>
    </div>
  );
}
