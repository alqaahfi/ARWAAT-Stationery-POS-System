import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import theme from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable } from '../../components/ui';
import { ListSummary, LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { NoSessions, SessionToolbar, sessionColumns } from './parts/SessionParts';

// The click-through detail view (SessionDetail.jsx) is where "what did this
// cashier actually do" lives — this list is just the index of sessions to
// pick from, one row per login.
export default function CashierSessions({ onNavigate }) {
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [search, setSearch] = useState('');
  const [cashierId, setCashierId] = useState('');
  const [sortBy, setSortBy] = useState('login_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const debounceRef = useRef(null);
  const searchRef = useRef('');
  const requestRef = useRef(0);

  useEffect(() => {
    window.api.users
      .list({ cashiersOnly: true, sortBy: 'full_name' })
      .then((rows) => setCashiers((rows || []).filter((r) => r.role === 'cashier')))
      .catch(() => setCashiers([]));
  }, []);

  const load = useCallback(async () => {
    const req = ++requestRef.current;
    setLoading(true);
    try {
      const rows = await window.api.sessions.list({
        search: searchRef.current,
        cashierId: cashierId ? Number(cashierId) : undefined,
        sortBy,
        sortDirection,
      });
      if (req !== requestRef.current) return;
      setSessions(rows || []);
      setLoadFailed(false);
    } catch {
      if (req === requestRef.current) setLoadFailed(true);
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [cashierId, sortBy, sortDirection]);

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
    if (cashierId) setCashierId('');
    else load();
  }

  const columns = useMemo(() => sessionColumns(), []);

  if (user.role !== 'admin') return <RestrictedNotice />;

  const filtered = !!(search.trim() || cashierId);

  return (
    <div style={{ paddingBottom: '48px' }}>
      <p style={{ ...theme.type.subhead, color: theme.colors.labelSecondary, margin: `0 0 ${theme.spacing.smd}` }}>
        When each cashier signed in, and for how long.
      </p>

      <SessionToolbar
        search={search}
        onSearch={handleSearchChange}
        cashiers={cashiers}
        cashierId={cashierId}
        onCashierId={setCashierId}
        sortBy={sortBy}
        onSortBy={setSortBy}
        sortDirection={sortDirection}
        onToggleDirection={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
      />

      <ListSummary>{loading ? 'Loading…' : `${sessions.length} session${sessions.length === 1 ? '' : 's'}`}</ListSummary>

      <Card padding="0" style={{ overflow: 'hidden' }}>
        {loadFailed ? (
          <LoadError message="Session Activity couldn't be loaded." onRetry={load} />
        ) : (
          <DataTable
            columns={columns}
            rows={sessions}
            loading={loading}
            onRowClick={(s) => onNavigate('/cashiers/sessions/detail', { id: s.id })}
            emptyState={<NoSessions filtered={filtered} onClear={clearFilters} />}
          />
        )}
      </Card>
    </div>
  );
}
