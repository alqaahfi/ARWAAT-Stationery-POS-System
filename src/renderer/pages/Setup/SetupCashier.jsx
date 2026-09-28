import React, { useState } from 'react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Banner, Button, Field, TextInput } from '../../components/ui';
import SetupShell from './SetupShell';

const TOTAL_STEPS = 4;

// Counter computer path: name -> Connection Code. The main computer is found
// automatically on the network; CashierInitialSync (step 4) follows.
export default function SetupCashier({ onActivated, onBack }) {
  const [step, setStep] = useState('name');
  const [stationCode, setStationCode] = useState('');
  const [syncSecret, setSyncSecret] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function goTo(next) {
    setFieldError('');
    setError('');
    setStep(next);
  }

  function submitName() {
    if (!stationCode.trim()) {
      setFieldError('Please enter a short name for this computer, like C1.');
      return;
    }
    goTo('code');
  }

  async function handleActivate() {
    setError('');
    if (!syncSecret.trim()) {
      setFieldError(`Please enter the ${glossary.connectionCode} shown on the main computer.`);
      return;
    }
    setFieldError('');
    setBusy(true);
    try {
      const res = await window.api.license.activateCashier({
        stationCode: stationCode.trim(),
        syncSecret: syncSecret.trim(),
      });
      if (!res.success) {
        setError("Couldn't save this setup. Please try again.");
        return;
      }
      onActivated();
    } finally {
      setBusy(false);
    }
  }

  const back = (onClick) => (
    <Button variant="secondary" size="lg" onClick={onClick} disabled={busy}>
      Back
    </Button>
  );

  if (step === 'name') {
    return (
      <SetupShell
        step={2}
        totalSteps={TOTAL_STEPS}
        stepKey="name"
        title="Name this computer"
        onSubmit={submitName}
        footer={
          <>
            {onBack && back(onBack)}
            <Button type="submit" size="lg" style={{ flex: 1 }}>
              Continue
            </Button>
          </>
        }
      >
        <Field label={glossary.computerName} hint="Give each counter computer a different short name, like C1 or C2." error={fieldError}>
          <TextInput
            value={stationCode}
            onChange={(e) => setStationCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="e.g. C1"
            autoFocus
          />
        </Field>
      </SetupShell>
    );
  }

  return (
    <SetupShell
      step={3}
      totalSteps={TOTAL_STEPS}
      stepKey="code"
      title={`Enter the ${glossary.connectionCode}`}
      onSubmit={handleActivate}
      footer={
        <>
          {back(() => goTo('name'))}
          <Button type="submit" size="lg" loading={busy} style={{ flex: 1 }}>
            Connect
          </Button>
        </>
      }
    >
      <Field label={glossary.connectionCode} hint="You can see this code on the main computer." error={fieldError}>
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
      <Banner>{error}</Banner>
    </SetupShell>
  );
}
