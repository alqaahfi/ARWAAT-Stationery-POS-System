import React, { useEffect, useRef, useState } from 'react';
import theme from '../../config/theme';
import { Banner, Button } from '../../components/ui';

// Shown once, right after SetupCashier.jsx saves the shared secret and
// station code — a brand-new Cashier PC has no user accounts yet, so Login
// can't work until it's pulled real data from Admin at least once. Polls
// discovery for a peer, then forces an immediate sync (not the normal
// 15-30s timer) and only hands off to Login once that's actually succeeded.
// See Step 6 of the sync design doc.
const POLL_INTERVAL_MS = 1000;
const OVERALL_TIMEOUT_MS = 20000;

export default function CashierInitialSync({ onDone }) {
  const [status, setStatus] = useState('waiting'); // waiting | syncing | timeout
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setStatus('waiting');
    let pollTimer = null;
    let timeoutTimer = null;

    async function tryOnce() {
      if (cancelledRef.current) return;
      const peers = await window.api.sync.getPeers();
      if (cancelledRef.current) return;

      if (!peers || peers.length === 0) {
        pollTimer = setTimeout(tryOnce, POLL_INTERVAL_MS);
        return;
      }

      setStatus('syncing');
      const results = await window.api.sync.triggerNow({});
      if (cancelledRef.current) return;

      const succeeded = Array.isArray(results) && results.some((r) => r.success);
      if (succeeded) {
        clearTimeout(timeoutTimer);
        onDone();
      } else {
        setStatus('waiting');
        pollTimer = setTimeout(tryOnce, POLL_INTERVAL_MS);
      }
    }

    tryOnce();
    timeoutTimer = setTimeout(() => {
      cancelledRef.current = true;
      clearTimeout(pollTimer);
      setStatus('timeout');
    }, OVERALL_TIMEOUT_MS);

    return () => {
      cancelledRef.current = true;
      clearTimeout(pollTimer);
      clearTimeout(timeoutTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Setting Up This PC</h2>

        {status !== 'timeout' ? (
          <>
            <p style={styles.message}>
              {status === 'syncing' ? 'Found the Admin PC — pulling your shop’s data…' : 'Connecting to Admin PC…'}
            </p>
            <p style={styles.hint}>Make sure the Admin PC is powered on and connected to the same WiFi/network.</p>
          </>
        ) : (
          <>
            <Banner>Couldn&apos;t reach the Admin PC yet — make sure it&apos;s running and on the same network.</Banner>
            <Button style={{ width: '100%', marginTop: '20px', padding: '12px' }} onClick={() => setAttempt((a) => a + 1)}>
              Retry
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
    textAlign: 'center',
    color: theme.colors.textPrimary,
  },
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, marginBottom: theme.spacing.lg },
  message: { fontSize: theme.font.sizeBase, color: theme.colors.textPrimary, margin: 0 },
  hint: { fontSize: theme.font.sizeXs, color: theme.colors.textSecondary, marginTop: theme.spacing.sm },
};
