import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CircleCheck, Download, RefreshCw } from 'lucide-react';
import theme from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { Badge, Banner, Button, Card, IconTile } from '../../components/ui';
import { RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, SettingsSkeleton, settingsColumn } from './parts/SettingsParts';

const c = theme.colors;

function formatSize(bytes) {
  if (!bytes) return null;
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatWhen(iso) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Never' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function ProgressBar({ percent }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ height: '8px', borderRadius: theme.radius.pill, backgroundColor: c.fill, overflow: 'hidden', margin: `${theme.spacing.sm} 0` }}
    >
      <div style={{ width: `${percent}%`, height: '100%', backgroundColor: c.accent, transition: `width ${theme.motion.fast} ease` }} />
    </div>
  );
}

// Settings -> Updates (Admin only): current version, check, and "Update now".
export default function Updates() {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const [checking, setChecking] = useState(false);
  const [installMessage, setInstallMessage] = useState('');
  const [installing, setInstalling] = useState(false);
  const wantInstall = useRef(false);

  const load = useCallback(() => window.api.updates.getState().then(setState).catch(() => {}), []);

  useEffect(() => {
    if (user.role === 'admin') load();
  }, [user.role, load]);

  // Download progress comes from the main process; poll while it runs.
  useEffect(() => {
    if (state?.status !== 'downloading') return undefined;
    const t = setInterval(load, 700);
    return () => clearInterval(t);
  }, [state?.status, load]);

  async function check() {
    setChecking(true);
    setInstallMessage('');
    try {
      setState(await window.api.updates.check());
    } finally {
      setChecking(false);
    }
  }

  async function install() {
    setInstalling(true);
    setInstallMessage('');
    try {
      const res = await window.api.updates.install();
      // On success the app closes and restarts by itself.
      if (!res?.success) setInstallMessage(res?.reason || 'The update could not be installed.');
    } finally {
      setInstalling(false);
      load();
    }
  }

  async function updateNow() {
    wantInstall.current = true;
    setInstallMessage('');
    const pending = window.api.updates.download();
    setTimeout(load, 100);
    const next = await pending;
    setState(next);
    if (next?.status === 'downloaded' && wantInstall.current) {
      wantInstall.current = false;
      await install();
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (!state) return <SettingsSkeleton cards={2} />;

  const { status, available, progress, error } = state;
  const downloading = status === 'downloading';
  const downloaded = status === 'downloaded';
  const size = formatSize(available?.sizeBytes);

  return (
    <div style={settingsColumn}>
      <PageIntro>Check whether a newer version of ARWAAT is ready, and install it. Your data is backed up automatically before every update.</PageIntro>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, marginBottom: theme.spacing.md }}>
          <IconTile icon={RefreshCw} color="blue" size="lg" variant="soft" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>Updates</h2>
            <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>
              Version {state.currentVersion} · Last checked: {formatWhen(state.lastCheckAt)}
            </div>
          </div>
          <Button
            variant="secondary"
            icon={RefreshCw}
            onClick={check}
            loading={checking || status === 'checking'}
            disabled={!state.supported || downloading || installing || status === 'installing'}
          >
            Check for updates
          </Button>
        </div>

        {!state.supported && <Banner tone="info">{state.message || 'Updates only work in the installed app.'}</Banner>}
        {state.supported && status === 'uptodate' && (
          <Banner tone="success">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <CircleCheck size={14} aria-hidden="true" /> You&apos;re up to date.
            </span>
          </Banner>
        )}
        {state.supported && status === 'error' && error && <Banner tone={error.kind === 'offline' ? 'warning' : 'error'}>{error.message}</Banner>}
      </Card>

      {state.supported && available && ['available', 'downloading', 'downloaded', 'installing'].includes(status) && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, marginBottom: theme.spacing.sm }}>
            <IconTile icon={Download} color="green" size="lg" variant="soft" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>
                Version {available.version} is available <Badge tone="green" size="sm">New</Badge>
              </h2>
              {size && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>Download size: {size}</div>}
            </div>
          </div>

          {available.notes && (
            <div
              style={{
                ...theme.type.body,
                color: c.label,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                maxHeight: '220px',
                overflowY: 'auto',
                padding: `${theme.spacing.smd} ${theme.spacing.md}`,
                borderRadius: theme.radius.md,
                backgroundColor: c.surfaceAlt,
                border: `1px solid ${c.separator}`,
                marginBottom: theme.spacing.md,
              }}
            >
              {available.notes}
            </div>
          )}

          {downloading && (
            <div>
              <div style={{ ...theme.type.subhead, color: c.label }}>Downloading… {progress?.percent || 0}%</div>
              <ProgressBar percent={progress?.percent || 0} />
            </div>
          )}
          {status === 'installing' && <Banner tone="info">Closing ARWAAT to install the update. It will open again by itself.</Banner>}
          {error && status === 'available' && <Banner tone="error">{error.message}</Banner>}
          <Banner tone="warning">{installMessage}</Banner>

          {!downloading && status !== 'installing' && (
            <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              {downloaded ? (
                <Button onClick={install} loading={installing}>
                  Install now
                </Button>
              ) : (
                <Button icon={Download} onClick={updateNow}>
                  {error ? 'Try again' : 'Update now'}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
