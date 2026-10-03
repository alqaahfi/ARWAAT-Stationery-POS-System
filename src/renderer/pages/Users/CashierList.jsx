import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable, useConfirm, useToast } from '../../components/ui';
import { ListSummary, LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { CashierToolbar, NoCashierMatch, NoCashiers, cashierColumns } from './parts/CashierListParts';
import { ResetPasswordModal } from './parts/ResetPasswordModal';

export default function CashierList({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [cashiers, setCashiers] = useState([]);
  const [definitions, setDefinitions] = useState([]);
  const [permsById, setPermsById] = useState({});
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [resetTarget, setResetTarget] = useState(null);
  const debounceRef = useRef(null);
  const searchRef = useRef('');
  const requestRef = useRef(0);

  useEffect(() => {
    window.api.permissions
      .getDefinitions()
      .then((defs) => setDefinitions(defs || []))
      .catch(() => setDefinitions([]));
  }, []);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const req = ++requestRef.current;
      if (!silent) setLoading(true);
      try {
        // Only cashiers here — the admin account is never managed from this module.
        const rows = await window.api.users.list({ search: searchRef.current, sortBy, sortDirection, cashiersOnly: true });
        if (req !== requestRef.current) return;
        const list = (rows || []).filter((r) => r.role === 'cashier');
        setCashiers(list);
        setLoadFailed(false);
        // Permission counts are a nice-to-have; a failure just leaves "—".
        Promise.all(list.map((r) => window.api.permissions.getForUser({ userId: r.id }).catch(() => null))).then((all) => {
          if (req !== requestRef.current) return;
          const map = {};
          list.forEach((r, i) => {
            if (all[i]) map[r.id] = all[i];
          });
          setPermsById(map);
        });
      } catch {
        if (req === requestRef.current) setLoadFailed(true);
      } finally {
        if (req === requestRef.current) setLoading(false);
      }
    },
    [sortBy, sortDirection]
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

  function clearSearch() {
    handleSearchChange('');
  }

  const toggleActive = useCallback(
    async (c) => {
      const next = c.is_active ? 0 : 1;
      if (!next) {
        const ok = await confirm({
          title: `Deactivate ${c.full_name}?`,
          message: 'They’ll be signed out and won’t be able to log in until you reactivate them.',
          confirmLabel: 'Deactivate',
        });
        if (!ok) return;
      }
      try {
        const res = await window.api.users.setActive({ id: c.id, isActive: next });
        if (res && res.success === false) toast.error(res.reason || 'Couldn’t change that. Please try again.');
        else toast.success(next ? `${c.full_name} can log in again` : `${c.full_name} is now inactive`);
      } catch {
        toast.error('Couldn’t change that. Please try again.');
      }
      load({ silent: true });
    },
    [confirm, load, toast]
  );

  const columns = useMemo(
    () => cashierColumns({ permsById, definitions, onToggleActive: toggleActive, onResetPassword: setResetTarget }),
    [permsById, definitions, toggleActive]
  );

  // Hard role gate — all hooks above run unconditionally every render; this
  // check only decides the returned JSX.
  if (user.role !== 'admin') return <RestrictedNotice />;

  const goAdd = () => onNavigate('/cashiers/new');

  return (
    <div style={{ paddingBottom: '48px' }}>
      <CashierToolbar
        search={search}
        onSearch={handleSearchChange}
        sortBy={sortBy}
        onSortBy={setSortBy}
        sortDirection={sortDirection}
        onToggleDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
        onAdd={goAdd}
      />

      <ListSummary>{loading ? 'Loading…' : `${cashiers.length} cashier${cashiers.length === 1 ? '' : 's'}`}</ListSummary>

      <Card padding="0" style={{ overflow: 'hidden' }}>
        {loadFailed ? (
          <LoadError message="The cashier list couldn't be loaded." onRetry={() => load()} />
        ) : (
          <DataTable
            columns={columns}
            rows={cashiers}
            loading={loading}
            onRowClick={(c) => onNavigate('/cashiers/edit', { id: c.id })}
            emptyState={search.trim() ? <NoCashierMatch onClear={clearSearch} /> : <NoCashiers onAdd={goAdd} />}
          />
        )}
      </Card>

      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}
