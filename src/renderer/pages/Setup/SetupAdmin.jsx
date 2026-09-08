import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Label, TextInput, TextArea, Banner, Button } from '../../components/ui';

export default function SetupAdmin({ onActivated, onBack }) {
  const [machineId, setMachineId] = useState('');
  const [shopName, setShopName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [stationCode, setStationCode] = useState('MAIN');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [syncSecret, setSyncSecret] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.api.license.getMachineId().then(setMachineId);
  }, []);

  async function handleActivate() {
    setError('');
    if (!shopName.trim() || !licenseKey.trim()) {
      setError('Please enter the shop name and license key.');
      return;
    }
    const res = await window.api.license.activateAdmin({
      licenseKey: licenseKey.trim(),
      shopName: shopName.trim(),
      stationCode: stationCode.trim() || 'MAIN',
    });
    if (!res.success) {
      setError(res.reason || 'Activation failed.');
      return;
    }
    setSyncSecret(res.syncSecret || '');
    setStep('secret');
  }

  async function handleCopySecret() {
    try {
      await navigator.clipboard.writeText(syncSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access blocked — the code is still shown on screen to copy by hand.
    }
  }

  async function handleCreateAdmin() {
    setError('');
    if (!fullName.trim() || !username.trim() || password.length < 6) {
      setError('Fill all fields — password must be at least 6 characters.');
      return;
    }
    const res = await window.api.users.createFirstAdmin({
      fullName: fullName.trim(),
      username: username.trim(),
      password,
    });
    if (!res.success) {
      setError(res.reason || 'Could not create admin user.');
      return;
    }
    onActivated();
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button style={styles.backLink} onClick={onBack}>&larr; Back</button>
        <h2 style={styles.title}>Set Up Admin PC</h2>

        {step === 1 && (
          <>
            <Label>This PC's Machine ID (send this to the developer)</Label>
            <div style={styles.machineIdBox}>{machineId || 'Loading...'}</div>

            <Label>Shop Name</Label>
            <TextInput value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Al-Falah Stationers" />

            <Label>License Key</Label>
            <TextArea value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)} placeholder="Paste the license key you received here" />

            <Label>Station Code</Label>
            <TextInput
              value={stationCode}
              onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="MAIN"
            />

            <Banner>{error}</Banner>

            <Button onClick={handleActivate} style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
              Activate
            </Button>
          </>
        )}

        {step === 'secret' && (
          <>
            <p style={styles.subtitle}>
              License activated. This is your shop's Sync Secret — you'll need to enter this exact code when setting up
              each Cashier PC, so every PC can talk to each other securely. Write it down or copy it now.
            </p>

            <Label>Sync Secret</Label>
            <div style={styles.machineIdBox}>{syncSecret}</div>
            <Button variant="secondary" onClick={handleCopySecret} style={{ marginTop: '10px' }}>
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button onClick={() => setStep(2)} style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
              Continue
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <p style={styles.subtitle}>License activated. Now create the Admin login account.</p>

            <Label>Full Name</Label>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />

            <Label>Username</Label>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} />

            <Label>Password</Label>
            <TextInput type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

            <Banner>{error}</Banner>

            <Button onClick={handleCreateAdmin} style={{ width: '100%', marginTop: '20px', padding: '12px' }}>
              Create Admin Account
            </Button>
          </>
        )}
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
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, marginBottom: '16px' },
  subtitle: { color: theme.colors.textSecondary, marginBottom: '16px', fontSize: theme.font.sizeBase },
  machineIdBox: {
    padding: '10px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.appBackground,
    border: `1px solid ${theme.colors.border}`,
    fontFamily: 'monospace',
    fontSize: theme.font.sizeXs,
    wordBreak: 'break-all',
    color: theme.colors.info,
  },
};
