import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { Badge, Banner, Button, Field, PasswordInput, TextInput } from '../components/ui';
import SetupShell from './Setup/SetupShell';

const c = theme.colors;

// One Login page for both apps. `mode` = which window this is: the Admin
// window signs in the Admin only, the Cashier window cashiers only (the main
// process enforces that; this only changes the wording and accent).
export default function Login({ mode = 'admin' }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const isCashier = mode === 'cashier';

  async function handleSubmit() {
    setError('');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) setError(res.reason || 'Authentication failed.');
  }

  function checkCapsLock(e) {
    setCapsLock(Boolean(e.getModifierState?.('CapsLock')));
  }

  return (
    <SetupShell
      title="Welcome back"
      subtitle={isCashier ? 'Sign in to the counter' : 'Sign in to manage the shop'}
      onSubmit={handleSubmit}
      footer={
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          style={isCashier ? { backgroundColor: c.greenText, color: c.labelOnAccent } : undefined}
        >
          Sign in
        </Button>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: theme.spacing.md }}>
        <Badge tone={isCashier ? 'green' : 'blue'}>{isCashier ? 'Cashier' : 'Admin'}</Badge>
      </div>
      <Field label="Username">
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
      </Field>
      <Field label="Password" hint={capsLock ? 'Caps Lock is on' : null} style={{ marginBottom: 0 }}>
        <PasswordInput
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={checkCapsLock}
          onKeyUp={checkCapsLock}
          onBlur={() => setCapsLock(false)}
        />
      </Field>
      <Banner style={{ marginTop: theme.spacing.md }}>{error}</Banner>
    </SetupShell>
  );
}
