import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { Banner, Button, Field, PasswordInput, TextInput } from '../components/ui';
import SetupShell from './Setup/SetupShell';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

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
      subtitle="Sign in to continue"
      onSubmit={handleSubmit}
      footer={
        <Button type="submit" size="lg" fullWidth loading={loading}>
          Sign in
        </Button>
      }
    >
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
