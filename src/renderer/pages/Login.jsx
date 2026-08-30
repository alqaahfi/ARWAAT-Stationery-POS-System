import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { Label, TextInput, Banner, Button } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username.trim(), password);
    setLoading(false);
    if (!res.success) setError(res.reason || 'Login failed.');
  }

  return (
    <div style={styles.container}>
      <form style={styles.card} onSubmit={handleSubmit}>
        <h2 style={styles.title}>Stationery POS Login</h2>

        <Label>Username</Label>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />

        <Label>Password</Label>
        <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <Banner>{error}</Banner>

        <Button type="submit" disabled={loading} style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
          {loading ? 'Logging in...' : 'Login'}
        </Button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.appBackground,
    fontFamily: theme.font.family,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.lg,
    width: '360px',
    color: theme.colors.textPrimary,
  },
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, marginBottom: '20px', textAlign: 'center' },
};
