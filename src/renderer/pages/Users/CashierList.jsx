import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Label, TextInput, Select, Banner, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const SORT_OPTIONS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'username', label: 'Username' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Date Added' },
];

export default function CashierList({ onNavigate }) {
  const { user } = useAuth();

  const [cashiers, setCashiers] = useState([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
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
    // Only cashiers here — the admin account is managed from Settings, not this module.
    const rows = await window.api.users.list({ search, sortBy, sortDirection, cashiersOnly: true });
    setCashiers(rows.filter((r) => r.role === 'cashier'));
    setLoading(false);
  }

  function toggleSortDirection() {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }

  async function toggleActive(c) {
    await window.api.users.setActive({ id: c.id, isActive: c.is_active ? 0 : 1 });
    load();
  }

  // Hard role gate, same as Customers — all hooks above run unconditionally
  // every render; this check only decides the returned JSX.
  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Cashiers" actions={<Button onClick={() => onNavigate('/cashiers/new')}>+ Add Cashier</Button>} />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <TextInput
            placeholder="Search name or username…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: '180px' }}>
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
                <th style={tableStyles.th}>Full Name</th>
                <th style={tableStyles.th}>Username</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}>Created</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {cashiers.map((c) => (
                <Tr key={c.id}>
                  <td style={tableStyles.td}>{c.full_name}</td>
                  <td style={tableStyles.td}>{c.username}</td>
                  <td style={tableStyles.td}>
                    <span style={c.is_active ? styles.statusActive : styles.statusInactive}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={tableStyles.td}>{formatDateTime(c.created_at)}</td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button
                        variant="ghost"
                        style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                        onClick={() => onNavigate('/cashiers/edit', { id: c.id })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                        onClick={() => setResetTarget(c)}
                      >
                        Reset Password
                      </Button>
                      <Button
                        variant={c.is_active ? 'danger' : 'secondary'}
                        style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                        onClick={() => toggleActive(c)}
                      >
                        {c.is_active ? 'Deactivate' : 'Reactivate'}
                      </Button>
                    </div>
                  </td>
                </Tr>
              ))}
              {!loading && cashiers.length === 0 && (
                <tr>
                  <td colSpan={5} style={tableStyles.emptyState}>
                    No cashiers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />}
    </div>
  );
}

function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setSaving(true);
    const res = await window.api.users.resetPassword({ id: user.id, newPassword: password });
    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not reset password.');
      return;
    }
    setDone(true);
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h3 style={modalStyles.title}>Reset Password — {user.full_name}</h3>

        {done ? (
          <>
            <p style={{ color: theme.colors.success }}>Password reset. {user.full_name} has been logged out everywhere.</p>
            <Button onClick={onClose}>Close</Button>
          </>
        ) : (
          <>
            <Label>New Password</Label>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />

            <Label>Confirm Password</Label>
            <TextInput type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />

            <Banner>{error}</Banner>

            <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
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
  statusActive: { color: theme.colors.success, fontSize: theme.font.sizeSm },
  statusInactive: { color: theme.colors.danger, fontSize: theme.font.sizeSm },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    padding: '24px',
    width: '400px',
    fontFamily: theme.font.family,
  },
  title: { color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, margin: 0, fontWeight: theme.font.weightSemibold },
};
