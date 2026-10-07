import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import { Avatar, Banner, Button, Field, PasswordInput } from '../components/ui';

const c = theme.colors;
const LOCK_KEY = 'pos_locked_user';

const LockContext = createContext({ locked: false, lock: () => {} });
export const useLock = () => useContext(LockContext);

function readLockedFor() {
  try {
    return localStorage.getItem(LOCK_KEY);
  } catch {
    return null;
  }
}

// The app stays mounted underneath the lock screen, so unlocking resumes the
// exact page, cart and form state. The lock survives a reload (it is keyed to
// the signed-in user) and is cleared by a correct password or by signing out.
export function LockProvider({ children }) {
  const { user } = useAuth();
  const [locked, setLocked] = useState(() => !!user && readLockedFor() === String(user.id));

  const lock = useCallback(() => {
    if (!user) return;
    try {
      localStorage.setItem(LOCK_KEY, String(user.id));
    } catch {
      // Storage unavailable — the lock still holds until the app reloads.
    }
    setLocked(true);
  }, [user]);

  const unlock = useCallback(() => {
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {
      // ignore
    }
    setLocked(false);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        lock();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lock]);

  return (
    <LockContext.Provider value={{ locked, lock }}>
      {children}
      {locked && user && <LockOverlay onUnlock={unlock} />}
    </LockContext.Provider>
  );
}

function LockOverlay({ onUnlock }) {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  // Keep focus on the password box so typing never leaks to the page behind.
  useEffect(() => {
    const el = wrapRef.current?.querySelector('input');
    el?.focus();
    function refocus(e) {
      if (!wrapRef.current?.contains(e.target)) wrapRef.current?.querySelector('input')?.focus();
    }
    document.addEventListener('focusin', refocus);
    return () => document.removeEventListener('focusin', refocus);
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    let res;
    try {
      res = await window.api.users.verifyPassword({ userId: user.id, password });
    } catch {
      res = { success: false, reason: 'Could not check the password. Try again.' };
    }
    setBusy(false);
    if (res.success) {
      setPassword('');
      onUnlock();
    } else {
      setError(res.reason || 'Wrong password.');
      setPassword('');
    }
  }

  async function signOut() {
    try {
      localStorage.removeItem(LOCK_KEY);
    } catch {
      // ignore
    }
    await logout();
  }

  return createPortal(
    // Stop every key from reaching the page behind (the sale screen listens on document).
    <div style={styles.scrim} onKeyDown={(e) => e.stopPropagation()} onKeyUp={(e) => e.stopPropagation()}>
      <form ref={wrapRef} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Screen locked" style={styles.card}>
        <div style={styles.lockIcon}>
          <Lock size={26} aria-hidden="true" />
        </div>
        <h2 style={{ ...theme.type.title2, color: c.label, margin: '12px 0 2px' }}>Screen locked</h2>
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginBottom: theme.spacing.md }}>
          Enter the password for {user.fullName} to continue where you left off.
        </div>
        <Avatar name={user.fullName} size={44} />
        <div style={{ width: '100%', marginTop: theme.spacing.md }}>
          <Field label="Password" style={{ marginBottom: 0 }}>
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </Field>
        </div>
        <Banner style={{ marginTop: theme.spacing.smd, width: '100%' }}>{error}</Banner>
        <Button type="submit" size="lg" fullWidth loading={busy} style={{ marginTop: theme.spacing.md }}>
          Unlock
        </Button>
        <Button variant="plain" size="sm" onClick={signOut} style={{ marginTop: theme.spacing.sm }}>
          Sign out instead
        </Button>
      </form>
    </div>,
    document.body
  );
}

// ---------------- header pieces ----------------

export function LockButton() {
  const { lock } = useLock();
  return (
    <Button variant="secondary" size="sm" icon={Lock} onClick={lock} title="Lock the screen (Ctrl+L)">
      Lock
    </Button>
  );
}

// Live clock: time with seconds, and the date beneath it.
export function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={styles.clock} aria-label="Current time">
      <div style={{ ...theme.type.headline, ...theme.font.numeric, color: c.label, lineHeight: 1.1 }}>
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
      <div style={{ ...theme.type.caption, color: c.labelSecondary, lineHeight: 1.2 }}>
        {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  );
}

const styles = {
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 5000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bg,
    fontFamily: theme.font.family,
  },
  card: {
    width: '360px',
    maxWidth: '90vw',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: theme.spacing.xl,
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    border: `1px solid ${c.separator}`,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
  },
  lockIcon: {
    width: '52px',
    height: '52px',
    borderRadius: theme.radius.pill,
    backgroundColor: c.accentTint,
    color: c.accent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clock: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', paddingRight: theme.spacing.xs, whiteSpace: 'nowrap' },
};
