import React, { useEffect, useState } from 'react';
import theme from '../config/theme';
import { Button, Field, Modal, PasswordInput, Select, TextArea, TextInput, useToast } from '../components/ui';

const c = theme.colors;

export default function LoginForgotPasswordModal({ mode = 'admin', initialUsername = '', onClose, onSuccess }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [username, setUsername] = useState(initialUsername || '');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.users.getRecoveryAccounts().then((list) => {
      if (Array.isArray(list)) {
        setAccounts(list);
        if (!username) {
          if (mode === 'admin') {
            const adminUser = list.find((u) => u.role === 'admin');
            if (adminUser) setUsername(adminUser.username);
          } else {
            const cashier = list.find((u) => u.role === 'cashier');
            if (cashier) setUsername(cashier.username);
          }
        }
      }
    }).catch(() => {});
  }, [mode, username]);

  async function handleReset(e) {
    if (e) e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please select or enter the account username.');
      return;
    }
    if (!recoveryKey.trim()) {
      setError('Please enter the Master Recovery Key.');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await window.api.users.recoverPassword({
        username: username.trim(),
        recoveryKey: recoveryKey.trim(),
        newPassword,
      });
      setSubmitting(false);

      if (res?.success) {
        toast.success(res.message || 'Password reset successfully.');
        onSuccess(username.trim());
      } else {
        setError(res?.reason || 'Password recovery failed. Please check your recovery key.');
      }
    } catch (err) {
      setSubmitting(false);
      setError(err?.message || 'Password recovery failed.');
    }
  }

  const accountOptions = accounts.map((u) => ({
    value: u.username,
    label: `${u.full_name} (@${u.username}) [${u.role === 'admin' ? 'Admin' : 'Cashier'}]`,
  }));

  return (
    <Modal
      open
      title="Recover Account Password"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleReset} loading={submitting}>
            Reset Password
          </Button>
        </>
      }
    >
      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        {accounts.length > 0 ? (
          <Field label="Account to Reset" required>
            <Select
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              options={accountOptions}
            />
          </Field>
        ) : (
          <Field label="Username" required>
            <TextInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
            />
          </Field>
        )}

        <Field
          label="Master Recovery Key"
          required
          hint="Enter the private system recovery master key"
        >
          <TextArea
            value={recoveryKey}
            onChange={(e) => setRecoveryKey(e.target.value)}
            placeholder="Paste your recovery key here..."
            rows={3}
            style={{ fontFamily: 'monospace', fontSize: '12px' }}
          />
        </Field>

        <Field label="New Password" required hint="At least 6 characters">
          <PasswordInput
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
        </Field>

        <Field label="Confirm New Password" required>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-type new password"
          />
        </Field>

        {error && (
          <div
            role="alert"
            style={{
              ...theme.type.footnote,
              color: c.redText,
              backgroundColor: c.redTint,
              padding: '10px 14px',
              borderRadius: theme.radius.sm,
            }}
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
