import React, { useRef, useState } from 'react';
import { Bug } from 'lucide-react';
import theme from '../config/theme';
import DevPanel from './DevPanel';

const CLICKS_TO_UNLOCK = 5;
const CLICK_WINDOW_MS = 3000;

// Mounted once at the true root of the render tree (see app.jsx), outside
// the router, so it's present on Setup and Login too — not just inside the
// normal authenticated Sidebar layout. Deliberately unobtrusive: a low-
// opacity icon in the corner, not styled like a normal button, that does
// nothing unless clicked 5 times within a 3-second window.
export default function DevPanelTrigger() {
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const clickState = useRef({ count: 0, lastClickAt: 0 });

  function handleIconClick() {
    const now = Date.now();
    const state = clickState.current;
    state.count = now - state.lastClickAt > CLICK_WINDOW_MS ? 1 : state.count + 1;
    state.lastClickAt = now;

    if (state.count >= CLICKS_TO_UNLOCK) {
      state.count = 0;
      setShowPasswordModal(true);
    }
  }

  if (unlocked) {
    return <DevPanel onClose={() => setUnlocked(false)} />;
  }

  return (
    <>
      <button
        onClick={handleIconClick}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          bottom: 8,
          right: 8,
          width: 22,
          height: 22,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: theme.colors.textSecondary,
          opacity: 0.18,
          cursor: 'default',
          zIndex: 99999,
        }}
      >
        <Bug size={16} />
      </button>

      {showPasswordModal && (
        <PasswordModal
          onCancel={() => setShowPasswordModal(false)}
          onUnlocked={() => {
            setShowPasswordModal(false);
            setUnlocked(true);
          }}
        />
      )}
    </>
  );
}

function PasswordModal({ onCancel, onUnlocked }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await window.api.devpanel.verifyPassword({ password });
      if (res.success) {
        onUnlocked();
      } else {
        setError('Incorrect password.');
        setPassword('');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100001,
      }}
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.colors.cardBackground,
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadow.dropdown,
          padding: theme.spacing.lg,
          width: 280,
          fontFamily: theme.font.family,
        }}
      >
        <div style={{ fontSize: theme.font.sizeBase, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary, marginBottom: theme.spacing.sm }}>
          Dev Panel
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '9px 10px',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.colors.border}`,
            fontSize: theme.font.sizeBase,
            fontFamily: theme.font.family,
            outline: 'none',
          }}
        />
        {error && (
          <div style={{ color: theme.colors.danger, fontSize: theme.font.sizeXs, marginTop: '6px' }}>{error}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 14px', borderRadius: theme.radius.md, border: `1px solid ${theme.colors.borderStrong}`, backgroundColor: theme.colors.cardBackground, color: theme.colors.textPrimary, cursor: 'pointer', fontSize: theme.font.sizeSm }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !password}
            style={{ padding: '8px 14px', borderRadius: theme.radius.md, border: 'none', backgroundColor: theme.colors.primary, color: theme.colors.primaryText, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: theme.font.sizeSm, opacity: submitting || !password ? 0.6 : 1 }}
          >
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
