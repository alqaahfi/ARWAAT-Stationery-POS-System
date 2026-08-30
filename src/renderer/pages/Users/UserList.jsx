import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Label, TextInput, Banner, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

export default function UserList({ onNavigate }) {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [resetTarget, setResetTarget] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const rows = await window.api.users.list();
    setUsers(rows);
  }

  async function toggleActive(u) {
    await window.api.users.setActive({ id: u.id, isActive: u.is_active ? 0 : 1 });
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
      <PageHeader title="Users" actions={<Button onClick={() => onNavigate('/users/new')}>+ Add Cashier</Button>} />

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Full Name</th>
                <th style={tableStyles.th}>Username</th>
                <th style={tableStyles.th}>Role</th>
                <th style={tableStyles.th}>Status</th>
                <th style={tableStyles.th}>Created</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isAdminRow = u.role === 'admin';
                const disabledTitle = isAdminRow ? 'Manage the admin account from Settings' : undefined;
                return (
                  <Tr key={u.id}>
                    <td style={tableStyles.td}>{u.full_name}</td>
                    <td style={tableStyles.td}>{u.username}</td>
                    <td style={tableStyles.td}>
                      <span style={isAdminRow ? styles.badgeAdmin : styles.badgeCashier}>{isAdminRow ? 'Admin' : 'Cashier'}</span>
                    </td>
                    <td style={tableStyles.td}>
                      <span style={u.is_active ? styles.statusActive : styles.statusInactive}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={tableStyles.td}>{formatDateTime(u.created_at)}</td>
                    <td style={tableStyles.td}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <Button
                          variant="ghost"
                          disabled={isAdminRow}
                          title={disabledTitle}
                          style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                          onClick={() => onNavigate('/users/edit', { id: u.id })}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={isAdminRow}
                          title={disabledTitle}
                          style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                          onClick={() => setResetTarget(u)}
                        >
                          Reset Password
                        </Button>
                        <Button
                          variant={u.is_active ? 'danger' : 'secondary'}
                          disabled={isAdminRow}
                          title={disabledTitle}
                          style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </Tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={tableStyles.emptyState}>
                    No users found.
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
  badgeAdmin: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    fontSize: theme.font.sizeXs,
  },
  badgeCashier: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.appBackground,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    border: `1px solid ${theme.colors.border}`,
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
