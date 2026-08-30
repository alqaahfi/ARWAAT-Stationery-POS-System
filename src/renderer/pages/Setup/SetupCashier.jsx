import React, { useState } from 'react';
import theme from '../../config/theme';
import { Label, TextInput, Banner, Button } from '../../components/ui';

export default function SetupCashier({ onActivated, onBack }) {
  const [adminHost, setAdminHost] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [error, setError] = useState('');

  async function handleActivate() {
    setError('');
    if (!adminHost.trim()) {
      setError('Enter the Admin PC address, e.g. 192.168.1.10:4000');
      return;
    }
    if (!stationCode.trim()) {
      setError('Enter a station code for this PC, e.g. C1');
      return;
    }
    const res = await window.api.license.activateCashier({ adminHost: adminHost.trim(), stationCode: stationCode.trim() });
    if (!res.success) {
      setError('Could not save cashier setup.');
      return;
    }
    onActivated();
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.backLink} onClick={onBack}>&larr; Back</button>
        <h2 style={styles.title}>Set Up Cashier PC</h2>
        <p style={styles.subtitle}>
          Enter the Admin PC's address on your shop's network. Ask the admin/manager for this.
        </p>

        <Label>Admin PC Address</Label>
        <TextInput value={adminHost} onChange={(e) => setAdminHost(e.target.value)} placeholder="192.168.1.10:4000" />

        <Label>Station Code</Label>
        <TextInput
          value={stationCode}
          onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="C1"
        />

        <Banner>{error}</Banner>

        <Button onClick={handleActivate} style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
          Save and Continue
        </Button>
      </div>
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
    width: '420px',
    color: theme.colors.textPrimary,
  },
  backLink: { background: 'none', border: 'none', color: theme.colors.textSecondary, cursor: 'pointer', marginBottom: '16px', fontSize: theme.font.sizeBase, padding: 0 },
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, marginBottom: '10px' },
  subtitle: { color: theme.colors.textSecondary, marginBottom: '16px', fontSize: theme.font.sizeBase, lineHeight: '1.5' },
};
