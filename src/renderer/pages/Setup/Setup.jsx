import React, { useState } from 'react';
import { Store } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import appIcons from '../../config/appIcons';
import { Banner, Button, Field, PasswordInput, Spinner, TextInput } from '../../components/ui';
import SetupShell, { ChoiceCard } from './SetupShell';

const c = theme.colors;

// The whole first-run setup on one screen: pick Admin or Cashier, fill the form,
// done. Nothing to buy or activate.
//   Admin   -> shop name + owner login (the sync secret is made automatically)
//   Cashier -> Connection Code from the Admin + a new cashier login
// onDone({ role, username, password }) lets the app sign the person straight in.
export default function Setup({ onDone }) {
  const [role, setRole] = useState(null);
  const [shopName, setShopName] = useState('');
  const [syncSecret, setSyncSecret] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const isAdmin = role === 'admin';

  function pickRole(next) {
    setRole(next);
    setErrors({});
    setError('');
  }

  async function handleSubmit() {
    setError('');
    const next = {};
    if (isAdmin && !shopName.trim()) next.shopName = 'Please enter your shop name.';
    if (!isAdmin && !syncSecret.trim()) next.syncSecret = `Please enter the ${glossary.connectionCode} shown on the main computer.`;
    if (!fullName.trim()) next.fullName = 'Please enter your full name.';
    if (!username.trim()) next.username = 'Please choose a username.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const creds = { fullName: fullName.trim(), username: username.trim(), password };
      const res = isAdmin
        ? await window.api.setup.createAdmin({ shopName: shopName.trim(), ...creds })
        : await window.api.setup.joinAsCashier({ syncSecret: syncSecret.trim(), ...creds });
      if (!res.success) {
        setError(res.reason || "Couldn't finish setup. Please try again.");
        return;
      }
      onDone({ role, username: creds.username, password });
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setError('');
    setRestoring(true);
    const res = await window.api.backup.validateAndRestore();
    if (res.canceled || !res.success) setRestoring(false);
    if (!res.canceled && !res.success) setError(res.reason || "Couldn't restore that backup. Please pick a different file.");
  }

  return (
    <SetupShell
      title="Set up this computer"
      subtitle="What will this computer be used for?"
      onSubmit={role ? handleSubmit : undefined}
      footer={
        role ? (
          <Button type="submit" size="lg" fullWidth loading={busy} disabled={restoring}>
            {isAdmin ? 'Finish setup' : 'Connect'}
          </Button>
        ) : null
      }
    >
      <div style={styles.choices}>
        <ChoiceCard
          icon={Store}
          color="blue"
          title="Admin"
          description="For the shop owner. Manage products, customers, money and reports."
          selected={isAdmin}
          onClick={() => pickRole('admin')}
        />
        <ChoiceCard
          icon={appIcons.sell.icon}
          color={appIcons.sell.color}
          title="Cashier"
          description="For a counter computer. Sell items and print receipts. The Admin computer must be set up first."
          selected={role === 'cashier'}
          onClick={() => pickRole('cashier')}
        />
      </div>

      {role && (
        <div style={styles.fields}>
          {isAdmin ? (
            <Field label="Shop Name" error={errors.shopName}>
              <TextInput value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="e.g. Al-Noor Book Depot" autoFocus />
            </Field>
          ) : (
            <Field label={glossary.connectionCode} hint="Ask the Admin. It is shown in Settings → Connected Computers." error={errors.syncSecret}>
              <TextInput
                value={syncSecret}
                onChange={(e) => setSyncSecret(e.target.value.trim())}
                placeholder="Paste or type the code"
                autoFocus
                spellCheck={false}
                autoComplete="off"
                style={{ fontFamily: theme.font.mono }}
              />
            </Field>
          )}
          <Field label="Full name" error={errors.fullName}>
            <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Username" error={errors.username}>
            <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Password" hint="At least 6 characters." error={errors.password}>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Banner>{error}</Banner>
        </div>
      )}

      {isAdmin && (
        <div style={styles.restore}>
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
        </div>
      )}
    </SetupShell>
  );
}

const styles = {
  choices: { display: 'flex', flexDirection: 'column', gap: theme.spacing.smd },
  fields: { marginTop: theme.spacing.lg },
  restore: { marginTop: theme.spacing.md, textAlign: 'center' },
  restoring: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    color: c.labelSecondary,
    ...theme.type.subhead,
  },
};
