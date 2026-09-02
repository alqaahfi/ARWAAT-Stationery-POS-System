import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Checkbox, Button, Banner, FieldError, HelperText } from '../../components/ui';

// Create mode collects username + password + permissions all in one form;
// Edit mode touches Full Name, Active status and permissions — username is
// fixed after creation and password changes go through the separate Reset
// Password action, never here.
export default function CashierForm({ cashierId, onDone, onCancel }) {
  const { user } = useAuth();
  const isEdit = !!cashierId;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [definitions, setDefinitions] = useState([]);
  const [permissionValues, setPermissionValues] = useState({});

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    window.api.permissions.getDefinitions().then(setDefinitions);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      window.api.users.list().then((rows) => rows.find((r) => r.id === cashierId)),
      window.api.permissions.getForUser({ userId: cashierId }),
    ]).then(([target, perms]) => {
      if (target) {
        setFullName(target.full_name);
        setUsername(target.username);
        setIsActive(!!target.is_active);
      }
      setPermissionValues(perms || {});
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashierId]);

  async function handleUsernameBlur() {
    if (isEdit || !username.trim()) return;
    const res = await window.api.users.checkUsernameUnique({ username: username.trim() });
    setUsernameError(res.unique ? '' : 'That username is already taken.');
  }

  function updatePermission(key, value) {
    setPermissionValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError('');
    if (!fullName.trim()) return setError('Full name is required.');

    let targetId = cashierId;

    if (isEdit) {
      setSaving(true);
      const res = await window.api.users.update({ id: cashierId, fullName: fullName.trim() });
      if (!res.success) {
        setSaving(false);
        setError(res.reason || 'Could not update cashier.');
        return;
      }
      const activeRes = await window.api.users.setActive({ id: cashierId, isActive });
      if (!activeRes.success) {
        setSaving(false);
        setError(activeRes.reason || 'Could not update status.');
        return;
      }
    } else {
      if (!username.trim()) return setError('Username is required.');
      if (usernameError) return setError(usernameError);
      if (password.length < 6) return setError('Password must be at least 6 characters.');
      if (password !== confirmPassword) return setError('Passwords do not match.');

      setSaving(true);
      const res = await window.api.users.createCashier({ fullName: fullName.trim(), username: username.trim(), password });
      if (!res.success) {
        setSaving(false);
        setError(res.reason || 'Could not create cashier account.');
        return;
      }
      targetId = res.id;
    }

    const permsRes = await window.api.permissions.saveForUser({ userId: targetId, values: permissionValues });
    setSaving(false);
    if (!permsRes.success) {
      setError(permsRes.reason || 'Cashier saved, but permissions could not be saved.');
      return;
    }
    onDone();
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!loaded) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Cashier' : 'Add Cashier'} />

      <div style={styles.grid}>
        <Card style={{ maxWidth: '480px' }}>
          <h4 style={styles.sectionTitle}>Account Info</h4>

          <Label>Full Name</Label>
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />

          <Label>Username</Label>
          <TextInput
            value={username}
            disabled={isEdit}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={handleUsernameBlur}
            style={isEdit ? { backgroundColor: theme.colors.appBackground, color: theme.colors.textSecondary } : undefined}
          />
          <FieldError>{usernameError}</FieldError>

          {!isEdit && (
            <>
              <Label>Password</Label>
              <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

              <Label>Confirm Password</Label>
              <TextInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </>
          )}

          {isEdit && <Checkbox label="Active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
        </Card>

        <Card style={{ maxWidth: '480px' }}>
          <h4 style={styles.sectionTitle}>Permissions</h4>
          {definitions.map((def) => (
            <div key={def.key} style={styles.row}>
              <div style={styles.rowHeader}>
                <div style={styles.rowLabel}>{def.label}</div>
                {def.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={!!permissionValues[def.key]}
                    onChange={(e) => updatePermission(def.key, e.target.checked)}
                  />
                ) : (
                  <input
                    type="number"
                    value={permissionValues[def.key] ?? ''}
                    onChange={(e) => updatePermission(def.key, e.target.value)}
                    placeholder="Shop default"
                    style={styles.numberInput}
                  />
                )}
              </div>
              <HelperText>{def.description}</HelperText>
            </div>
          ))}
        </Card>
      </div>

      <Banner>{error}</Banner>

      <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg, alignItems: 'start' },
  sectionTitle: { margin: `0 0 ${theme.spacing.md} 0`, color: theme.colors.textPrimary },
  row: { padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.border}` },
  rowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, fontWeight: theme.font.weightMedium },
  numberInput: {
    width: '100px',
    padding: '6px 8px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'right',
    fontSize: theme.font.sizeSm,
  },
};
