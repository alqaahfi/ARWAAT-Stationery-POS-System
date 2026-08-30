import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Checkbox, Button, Banner, FieldError } from '../../components/ui';

// Create mode collects username + password; Edit mode only ever touches Full
// Name and Active status — username is fixed after creation and password
// changes go through the separate Reset Password action, never here.
export default function UserForm({ userId, onNavigate, onDone }) {
  const { user } = useAuth();
  const isEdit = !!userId;

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    window.api.users.list().then((rows) => {
      const target = rows.find((r) => r.id === userId);
      if (target) {
        setFullName(target.full_name);
        setUsername(target.username);
        setIsActive(!!target.is_active);
      }
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleUsernameBlur() {
    if (isEdit || !username.trim()) return;
    const res = await window.api.users.checkUsernameUnique({ username: username.trim() });
    setUsernameError(res.unique ? '' : 'That username is already taken.');
  }

  async function handleSave() {
    setError('');
    if (!fullName.trim()) return setError('Full name is required.');

    if (isEdit) {
      setSaving(true);
      const res = await window.api.users.update({ id: userId, fullName: fullName.trim() });
      if (!res.success) {
        setSaving(false);
        setError(res.reason || 'Could not update user.');
        return;
      }
      const activeRes = await window.api.users.setActive({ id: userId, isActive });
      setSaving(false);
      if (!activeRes.success) return setError(activeRes.reason || 'Could not update status.');
      onDone();
      return;
    }

    if (!username.trim()) return setError('Username is required.');
    if (usernameError) return setError(usernameError);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirmPassword) return setError('Passwords do not match.');

    setSaving(true);
    const res = await window.api.users.createCashier({ fullName: fullName.trim(), username: username.trim(), password });
    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not create cashier account.');
      return;
    }
    // Redirect straight into Permissions so this cashier doesn't sit with zero access.
    onNavigate('/users/permissions', { userId: res.id });
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
      <Card style={{ maxWidth: '480px' }}>
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

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
