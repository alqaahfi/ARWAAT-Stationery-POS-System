import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, TextInput, Select, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const SORT_OPTIONS = [
  { key: 'login_at', label: 'Login Time' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'activity_count', label: 'Activity Count' },
];

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso.replace(' ', 'T') + 'Z');
  const end = new Date(endIso.replace(' ', 'T') + 'Z');
  const ms = end - start;
  if (Number.isNaN(ms) || ms < 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// The click-through detail view (SessionDetail.jsx) is where "what did this
// cashier actually do" lives — this list is just the index of sessions to
// pick from, one row per login.
export default function CashierSessions({ onNavigate }) {
  const { user } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('login_at');
  const [sortDirection, setSortDirection] = useState('desc');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortDirection]);

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 250);
  }

  async function load() {
    setLoading(true);
    const rows = await window.api.sessions.list({ search, sortBy, sortDirection });
    setSessions(rows);
    setLoading(false);
  }

  function toggleSortDirection() {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Session Activity" />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <TextInput
            placeholder="Search cashier name or username…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '190px' }}>
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                Sort: {opt.label}
              </option>
            ))}
          </Select>
          <button style={styles.sortDirBtn} onClick={toggleSortDirection} title="Toggle sort direction">
            {sortDirection === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
          </button>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Cashier</th>
                <th style={tableStyles.th}>Login Time</th>
                <th style={tableStyles.th}>Logout Time</th>
                <th style={tableStyles.th}>Duration</th>
                <th style={tableStyles.th}>Status</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Activities</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const duration = formatDuration(s.login_at, s.ended_at);
                return (
                  <Tr key={s.id} onClick={() => onNavigate('/cashiers/sessions/detail', { id: s.id })}>
                    <td style={tableStyles.td}>
                      <div style={{ fontWeight: theme.font.weightMedium }}>{s.cashier_name}</div>
                      <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs }}>{s.username}</div>
                    </td>
                    <td style={tableStyles.td}>{formatDateTime(s.login_at)}</td>
                    <td style={tableStyles.td}>{s.ended_at ? formatDateTime(s.ended_at) : '—'}</td>
                    <td style={tableStyles.td}>{duration || (s.is_active ? 'In progress' : '—')}</td>
                    <td style={tableStyles.td}>
                      <span style={s.is_active ? styles.statusActive : styles.statusEnded}>
                        {s.is_active ? 'Active' : 'Ended'}
                      </span>
                    </td>
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>{s.activity_count}</td>
                  </Tr>
                );
              })}
              {!loading && sessions.length === 0 && (
                <tr>
                  <td colSpan={6} style={tableStyles.emptyState}>
                    No sessions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: theme.spacing.sm, alignItems: 'center' },
  sortDirBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    flexShrink: 0,
  },
  statusActive: { color: theme.colors.success, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightMedium },
  statusEnded: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
};
