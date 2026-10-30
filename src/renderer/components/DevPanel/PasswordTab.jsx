import React, { useState } from 'react';
import theme from './devPanelTheme';
import { PanelButton, PanelInput } from './shared';

const MIN_LENGTH = 8;

// Change this computer's Dev Panel password (stored only as a bcrypt hash on this PC).
export default function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  async function save() {
    if (busy) return;
    if (next.length < MIN_LENGTH) return setMessage({ ok: false, text: `The new password must be at least ${MIN_LENGTH} characters.` });
    if (next !== again) return setMessage({ ok: false, text: 'The two new passwords are not the same.' });
    setBusy(true);
    setMessage(null);
    try {
      const res = await window.api.devpanel.changePassword({ currentPassword: current, newPassword: next });
      if (res?.success) {
        setMessage({ ok: true, text: 'Password changed. Use the new one the next time you open the Dev Panel.' });
        setCurrent('');
        setNext('');
        setAgain('');
      } else {
        setMessage({ ok: false, text: res?.reason || 'The password could not be changed.' });
      }
    } catch {
      setMessage({ ok: false, text: 'The password could not be changed.' });
    } finally {
      setBusy(false);
    }
  }

  const row = { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: theme.spacing.sm };
  const label = { fontSize: theme.font.sizeSm, color: theme.colors.panelTextSecondary };

  return (
    <form
      style={{ maxWidth: '420px' }}
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <p style={{ fontSize: theme.font.sizeSm, color: theme.colors.panelTextSecondary, marginTop: 0 }}>
        Changes the Dev Panel password on THIS computer only. Each computer keeps its own.
      </p>
      <label style={row}>
        <span style={label}>Current password</span>
        <PanelInput type="password" autoComplete="off" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label style={row}>
        <span style={label}>New password (at least {MIN_LENGTH} characters)</span>
        <PanelInput type="password" autoComplete="off" value={next} onChange={(e) => setNext(e.target.value)} />
      </label>
      <label style={row}>
        <span style={label}>New password again</span>
        <PanelInput type="password" autoComplete="off" value={again} onChange={(e) => setAgain(e.target.value)} />
      </label>
      <PanelButton variant="primary" onClick={save} disabled={busy || !current || !next || !again}>
        Change password
      </PanelButton>
      {message && (
        <div role="status" style={{ marginTop: theme.spacing.sm, fontSize: theme.font.sizeSm, color: message.ok ? theme.colors.success || '#7ee787' : theme.colors.error || '#ff7b72' }}>
          {message.text}
        </div>
      )}
    </form>
  );
}
