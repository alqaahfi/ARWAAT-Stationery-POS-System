import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable, useToast } from '../../components/ui';
import { formatCurrency } from '../../utils/format';
import { NoSuppliers, SupplierToolbar, supplierColumns, supplierSubline } from './parts/SupplierListParts';
import { PartyCards, usePartyViewMode } from '../Parties/PartyViews';
import { ListSummary, LoadError, NoMatch, RestrictedNotice } from '../Parties/PartyParts';
import useRememberedState from '../../utils/useRememberedState';

export default function SupplierList({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useRememberedState('suppliers.search', '');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [viewMode, setViewMode] = usePartyViewMode('pos_supplier_view_mode');
  const debounceRef = useRef(null);
  const searchRef = useRef('');
  const requestRef = useRef(0);

  const load = useCallback(async ({ silent = false } = {}) => {
    const req = ++requestRef.current;
    if (!silent) setLoading(true);
    try {
      const rows = await window.api.suppliers.list({ search: searchRef.current });
      if (req !== requestRef.current) return;
      setSuppliers(rows || []);
      setLoadFailed(false);
    } catch {
      if (req === requestRef.current) setLoadFailed(true);
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return () => clearTimeout(debounceRef.current);
  }, [load]);

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
    load();
  }

  const toggleActive = useCallback(
    async (s) => {
      const next = s.is_active ? 0 : 1;
      setSuppliers((list) => list.map((row) => (row.id === s.id ? { ...row, is_active: next } : row)));
      try {
        await window.api.suppliers.setActive({ id: s.id, isActive: next });
        toast.success(next ? `${s.name} is active again` : `${s.name} is now inactive`);
      } catch {
        toast.error("Couldn't change that. Please try again.");
      }
      load({ silent: true });
    },
    [load, toast]
  );

  const columns = useMemo(() => supplierColumns({ onToggleActive: toggleActive, compact: viewMode === 'compact' }), [toggleActive, viewMode]);

  const summary = useMemo(() => {
    const owed = suppliers.reduce((sum, s) => (Number(s.balance_owed) > 0 ? sum + Number(s.balance_owed) : sum), 0);
    const hasBalances = suppliers.some((s) => s.balance_owed !== undefined);
    return { count: suppliers.length, owed, hasBalances };
  }, [suppliers]);

  // Hard role gate — Suppliers is admin-only regardless of the permission
  // system, same rule as Customers. All hooks above run unconditionally every
  // render; this check only decides the returned JSX.
  if (user.role !== 'admin') {
    return <RestrictedNotice />;
  }

  const goAdd = () => onNavigate('/suppliers/new');

  return (
    <div style={{ paddingBottom: '48px' }}>
      <SupplierToolbar search={search} onSearch={handleSearchChange} viewMode={viewMode} onViewMode={setViewMode} onAdd={goAdd} />

      <ListSummary>
        {loading
          ? 'Loading…'
          : `${summary.count} supplier${summary.count === 1 ? '' : 's'}${
              summary.hasBalances && summary.owed > 0 ? ` · You owe ${formatCurrency(summary.owed)} in total` : ''
            }`}
      </ListSummary>

      {loadFailed ? (
        <Card padding="0">
          <LoadError message="The supplier list couldn't be loaded." onRetry={() => load()} />
        </Card>
      ) : viewMode === 'grid' && !loading && suppliers.length > 0 ? (
        <PartyCards
          rows={suppliers}
          party="supplier"
          subline={supplierSubline}
          onOpen={(s) => onNavigate('/suppliers/profile', { id: s.id })}
          onToggleActive={toggleActive}
        />
      ) : (
        <Card padding="0" style={{ overflow: 'hidden' }}>
          <DataTable
            columns={columns}
            rows={suppliers}
            loading={loading}
            dense={viewMode === 'compact'}
            onRowClick={(s) => onNavigate('/suppliers/profile', { id: s.id })}
            emptyState={search.trim() ? <NoMatch what="suppliers" onClear={clearFilters} /> : <NoSuppliers onAdd={goAdd} />}
          />
        </Card>
      )}
    </div>
  );
}
