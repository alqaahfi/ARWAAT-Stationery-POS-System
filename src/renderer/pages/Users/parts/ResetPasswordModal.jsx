import React, { useState } from 'react';
import glossary from '../../../config/glossary';
import { Banner, Button, Field, Modal, PasswordInput, useToast } from '../../../components/ui';

// Sets a new password for one cashier. The server revokes all their
// sessions, so they have to log in again with the new one.
export function ResetPasswordModal({ user, onClose }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e?.preventDefault();
    setServerError('');
    const next = {};
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    else if (password !== confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length) {
      document.getElementById(next.password ? 'reset-password-new' : 'reset-password-confirm')?.focus();
      return;
    }

    setSaving(true);
    try {
      const res = await window.api.users.resetPassword({ id: user.id, newPassword: password });
      if (!res.success) {
        setServerError(res.reason || 'Could not reset password.');
        return;
      }
      toast.success('Password reset — they’ll need to log in again');
      onClose();
    } catch {
      setServerError('Could not reset password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={glossary.resetPassword}
      subtitle={`For ${user.full_name}. They’ll be signed out everywhere.`}
      width={420}
      footer={
        <>
          <Button variant="plain" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="reset-password-form" loading={saving}>
            {glossary.resetPassword}
          </Button>
        </>
      }
    >
      <form id="reset-password-form" onSubmit={handleSave} noValidate>
        <Field label="New password" error={errors.password} hint="At least 6 characters.">
          <PasswordInput id="reset-password-new" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Confirm password" error={errors.confirm} style={{ marginBottom: 0 }}>
          <PasswordInput id="reset-password-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        <Banner>{serverError}</Banner>
      </form>
    </Modal>
  );
}
