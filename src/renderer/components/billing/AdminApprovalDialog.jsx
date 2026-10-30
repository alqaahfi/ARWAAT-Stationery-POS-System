import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import theme from '../../config/theme';
import { Banner, Button, Field, Modal, PasswordInput, TextInput } from '../ui';

const c = theme.colors;

// Rule 12: "Admin approval" on the cashier screen. The Admin types their own
// username + password right here; the main process checks it (same lockout as
// the login screen) and hands back a one-time approval for this window. The
// cashier stays signed in the whole time.
export default function AdminApprovalDialog({ labels = [], message, onApproved, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current?.focus();
  }, []);

  async function submit(e) {
    e?.preventDefault?.();
    if (busy) return;
    setError('');
    if (!username.trim() || !password) {
      setError('Type the Admin username and password.');
      return;
    }
    setBusy(true);
    try {
      const res = await window.api.approvals.request({ username: username.trim(), password });
      if (!res?.success) {
        setError(res?.reason || 'Not approved.');
        setPassword('');
        return;
      }
      onApproved(res.approvalToken, res.adminName);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Admin approval"
      subtitle="The Admin types their own username and password here."
      width={440}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={ShieldCheck} onClick={submit} disabled={busy}>
            Approve
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        {labels.length > 0 && (
          <ul style={{ margin: `0 0 ${theme.spacing.sm}`, paddingLeft: '18px', ...theme.type.body, color: c.label }}>
            {labels.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {message && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginBottom: theme.spacing.md }}>{message}</div>}
        <Field label="Admin username">
          <TextInput ref={userRef} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Admin password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
        </Field>
        <Banner>{error}</Banner>
        <button type="submit" hidden aria-hidden="true" />
      </form>
    </Modal>
  );
}
