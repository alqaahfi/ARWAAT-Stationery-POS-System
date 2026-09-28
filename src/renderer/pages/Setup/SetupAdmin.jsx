import React, { useState } from 'react';
import { Copy } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Banner, Button, Checkbox, Field, PasswordInput, Spinner, TextInput, useToast } from '../../components/ui';
import SetupShell from './SetupShell';

const c = theme.colors;
const TOTAL_STEPS = 5;
const STEP_NUMBER = { shop: 2, key: 3, secret: 4, account: 5 };

// "abcde12345..." -> "ABCDE-12345-...": uppercase, 4 groups of 5.
function formatKey(raw) {
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
  return (chars.match(/.{1,5}/g) || []).join('-');
}

// Main computer path: shop -> key -> Connection Code -> owner account.
// resumeCreateAccount: the license is already activated (persisted in
// license_activation) but no admin user exists yet.
export default function SetupAdmin({ onActivated, onBack, resumeCreateAccount = false }) {
  const toast = useToast();
  const [step, setStep] = useState(resumeCreateAccount ? 'account' : 'shop');
  const [shopName, setShopName] = useState('');
  const [stationCode, setStationCode] = useState('MAIN');
  const [licenseKey, setLicenseKey] = useState('');
  const [syncSecret, setSyncSecret] = useState('');
  const [savedCode, setSavedCode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  function goTo(next) {
    setErrors({});
    setError('');
    setRestoreError('');
    setStep(next);
  }

  function submitShop() {
    if (!shopName.trim()) {
      setErrors({ shopName: 'Please enter your shop name.' });
      return;
    }
    goTo('key');
  }

  async function handleActivate() {
    setError('');
    if (!licenseKey.trim()) {
      setErrors({ licenseKey: 'Please enter your activation key.' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await window.api.license.activateAdmin({
        licenseKey: licenseKey.trim().replace(/\s+/g, '').toUpperCase(),
        shopName: shopName.trim(),
        stationCode: stationCode.trim() || 'MAIN',
      });
      if (!res.success) {
        setError("This key isn't valid or has already been used. Please check it, or contact ARWAAT for a new one.");
        return;
      }
      setSyncSecret(res.syncSecret || '');
      goTo('secret');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopySecret() {
    try {
      await navigator.clipboard.writeText(syncSecret);
      setSavedCode(true);
      toast.success('Copied');
    } catch {
      toast.error("Couldn't copy. Please write the code down instead.");
    }
  }

  async function handleCreateAdmin() {
    setError('');
    const next = {};
    if (!fullName.trim()) next.fullName = "Please enter the owner's full name.";
    if (!username.trim()) next.username = 'Please choose a username.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const res = await window.api.users.createFirstAdmin({
        fullName: fullName.trim(),
        username: username.trim(),
        password,
      });
      if (!res.success) {
        setError(res.reason || "Couldn't create the owner account. Please try again.");
        return;
      }
      onActivated();
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setRestoreError('');
    setRestoring(true);
    const res = await window.api.backup.validateAndRestore();
    if (res.canceled || !res.success) setRestoring(false);
    if (res.canceled) return;
    if (!res.success) {
      setRestoreError(res.reason || "Couldn't restore that backup. Please pick a different file.");
    }
  }

  const shell = { step: STEP_NUMBER[step], totalSteps: TOTAL_STEPS, stepKey: step };
  const backButton = (onClick) => (
    <Button variant="secondary" size="lg" onClick={onClick} disabled={busy || restoring}>
      Back
    </Button>
  );

  if (step === 'shop') {
    return (
      <SetupShell
        {...shell}
        title="Tell us about your shop"
        onSubmit={submitShop}
        footer={
          <>
            {onBack && backButton(onBack)}
            <Button type="submit" size="lg" style={{ flex: 1 }}>
              Continue
            </Button>
          </>
        }
      >
        <Field label="Shop Name" error={errors.shopName}>
          <TextInput value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Al-Noor Book Depot" autoFocus />
        </Field>
        <Field label={glossary.computerName} hint="A short name for this computer. Keep MAIN for the owner's computer.">
          <TextInput
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="MAIN"
          />
        </Field>
      </SetupShell>
    );
  }

  if (step === 'key') {
    return (
      <SetupShell
        {...shell}
        title="Enter your activation key"
        onSubmit={handleActivate}
        footer={
          <>
            {backButton(() => goTo('shop'))}
            <Button type="submit" size="lg" loading={busy} disabled={restoring} style={{ flex: 1 }}>
              Activate
            </Button>
          </>
        }
      >
        <Field label="Activation Key" hint="You received this key from ARWAAT." error={errors.licenseKey}>
          <TextInput
            value={licenseKey}
            onChange={(e) => setLicenseKey(formatKey(e.target.value))}
            placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            style={{ fontFamily: theme.font.mono, letterSpacing: '0.06em' }}
          />
        </Field>
        <Banner>{error}</Banner>

        <div style={{ marginTop: theme.spacing.md, textAlign: 'center' }}>
          {restoring ? (
            <div role="status" style={styles.restoring}>
              <Spinner size={16} />
              Restoring your data… the app will restart.
            </div>
          ) : (
            <Button variant="plain" size="sm" onClick={handleRestore} disabled={busy}>
              Already have a backup? Restore it instead
            </Button>
          )}
          <Banner style={{ textAlign: 'left' }}>{restoreError}</Banner>
        </div>
      </SetupShell>
    );
  }

  if (step === 'secret') {
    return (
      <SetupShell
        {...shell}
        title={`Your ${glossary.connectionCode}`}
        subtitle="Counter computers need this code to connect to this computer. Write it down or copy it now."
        onSubmit={() => savedCode && goTo('account')}
        footer={
          <Button type="submit" size="lg" fullWidth disabled={!savedCode}>
            Continue
          </Button>
        }
      >
        <div style={styles.codeBox}>{syncSecret}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: theme.spacing.smd }}>
          <Button variant="tinted" icon={Copy} onClick={handleCopySecret}>
            Copy
          </Button>
        </div>
        <Checkbox label="I've saved this code" checked={savedCode} onChange={(e) => setSavedCode(e.target.checked)} />
      </SetupShell>
    );
  }

  return (
    <SetupShell
      {...shell}
      title="Create the owner account"
      subtitle={resumeCreateAccount ? null : "You'll use this to sign in and manage the shop."}
      onSubmit={handleCreateAdmin}
      footer={
        <Button type="submit" size="lg" fullWidth loading={busy}>
          Finish setup
        </Button>
      }
    >
      {resumeCreateAccount && (
        <Banner tone="info" style={{ marginTop: 0, marginBottom: theme.spacing.md }}>
          This computer is already activated — just create the owner account.
        </Banner>
      )}
      <Field label="Full name" error={errors.fullName}>
        <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} autoFocus />
      </Field>
      <Field label="Username" error={errors.username}>
        <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="Password" hint="At least 6 characters." error={errors.password}>
        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </Field>
      <Banner>{error}</Banner>
    </SetupShell>
  );
}

const styles = {
  restoring: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    color: c.labelSecondary,
    ...theme.type.subhead,
  },
  codeBox: {
    padding: `${theme.spacing.lg} ${theme.spacing.md}`,
    borderRadius: theme.radius.lg,
    backgroundColor: c.surfaceAlt,
    border: `1px solid ${c.separator}`,
    fontFamily: theme.font.mono,
    fontSize: '22px',
    fontWeight: theme.font.weightSemibold,
    letterSpacing: '0.12em',
    textAlign: 'center',
    wordBreak: 'break-all',
    color: c.label,
    userSelect: 'all',
  },
};
