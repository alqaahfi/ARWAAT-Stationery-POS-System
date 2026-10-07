import React, { useEffect, useRef, useState } from 'react';
import { Check, Circle } from 'lucide-react';
import theme from '../../config/theme';
import { Button, Icon, Spinner } from '../../components/ui';
import SetupShell from './SetupShell';

const c = theme.colors;

// Shown once, right after Setup.jsx has registered this counter PC with the
// Admin — a brand-new Cashier PC has no user accounts yet, so Login can't
// work until it's pulled real data from Admin at least once. Polls
// discovery for a peer, then forces an immediate sync (not the normal
// 15-30s timer) and only hands off to Login once that's actually succeeded.
// See Step 6 of the sync design doc.
const POLL_INTERVAL_MS = 1000;
const OVERALL_TIMEOUT_MS = 20000;
const ALL_SET_MS = 900;

// Which progress line each status has reached (0-based index of the active line).
const PROGRESS = { waiting: 0, syncing: 1, done: 3 };
const LINES = ['Looking for the main computer', 'Copying shop data', 'Ready'];

export default function CashierInitialSync({ onDone }) {
  const [status, setStatus] = useState('waiting'); // waiting | syncing | done | timeout
  const [attempt, setAttempt] = useState(0);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setStatus('waiting');
    let pollTimer = null;
    let timeoutTimer = null;
    let doneTimer = null;

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
        setStatus('done');
        doneTimer = setTimeout(onDone, ALL_SET_MS);
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
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (status === 'timeout') {
    return (
      <SetupShell
        stepKey="timeout"
        title="Couldn't find the main computer yet"
        onSubmit={() => setAttempt((a) => a + 1)}
        footer={
          <Button type="submit" size="lg" fullWidth autoFocus>
            Try again
          </Button>
        }
      >
        <ul role="alert" style={styles.checklist}>
          <li>Is the main computer turned on? Are both computers on the same WiFi?</li>
          <li>If this keeps happening, ask the Admin to check that the main computer is open.</li>
        </ul>
      </SetupShell>
    );
  }

  const done = status === 'done';
  const active = PROGRESS[status];

  return (
    <SetupShell stepKey="connecting" title={done ? 'All set' : 'Connecting to the main computer…'}>
      <span aria-live="polite" style={styles.srOnly}>
        {done ? 'All set' : LINES[active]}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.smd }}>
        {LINES.map((text, i) => {
          const state = i < active ? 'done' : i === active ? 'active' : 'todo';
          return (
            <div key={text} style={{ ...styles.line, color: state === 'todo' ? c.labelTertiary : c.label }}>
              {state === 'done' ? (
                <Icon icon={Check} size={18} style={{ color: c.greenText }} />
              ) : state === 'active' ? (
                <Spinner size={18} style={{ color: c.accent }} />
              ) : (
                <Icon icon={Circle} size={18} />
              )}
              <span>{text}</span>
            </div>
          );
        })}
      </div>
      <p style={styles.hint}>Keep the main computer on and connected to the same WiFi.</p>
    </SetupShell>
  );
}

const styles = {
  srOnly: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
  line: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, ...theme.type.body },
  hint: { ...theme.type.footnote, color: c.labelSecondary, margin: `${theme.spacing.lg} 0 0` },
  checklist: {
    margin: 0,
    paddingLeft: theme.spacing.mdl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    color: c.labelSecondary,
    ...theme.type.body,
  },
};
