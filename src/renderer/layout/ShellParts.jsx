import React, { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import theme from '../config/theme';
import glossary from '../config/glossary';
import { IconButton } from '../components/ui';
import useInteraction from '../components/kit/useInteraction';
import { SALE_COMPLETED_EVENT } from '../pages/POS/Sale';

const c = theme.colors;
const REFRESH_INTERVAL_MS = 60000;

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

// Initials avatar + name + role + Sign out.
export function UserChip({ user, onLogout, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, ...style }}>
      <div
        aria-hidden="true"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: theme.radius.pill,
          backgroundColor: c.accentTint,
          color: c.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.type.footnote,
          fontWeight: theme.font.weightSemibold,
          flexShrink: 0,
        }}
      >
        {initials(user.fullName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.fullName}
        </div>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, textTransform: 'capitalize' }}>{user.role}</div>
      </div>
      <IconButton icon={LogOut} label={glossary.signOut} size="sm" onClick={onLogout} />
    </div>
  );
}

// Polls the existing sync:get-status IPC (and refreshes right after a sale).
function useSyncStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => window.api.sync.getStatus().then((s) => alive && setStatus(s));
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener(SALE_COMPLETED_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(interval);
      window.removeEventListener(SALE_COMPLETED_EVENT, refresh);
    };
  }, []);
  return status;
}

// Green "Up to date" / orange "Waiting to connect". Clickable only when
// onNavigate is given (goes to Connected Computers).
export function SyncChip({ onNavigate }) {
  const status = useSyncStatus();
  const clickable = !!onNavigate;
  const { hovered, handlers } = useInteraction(!clickable);
  if (!status) return null;

  const waiting = status.pendingCount > 0 || status.lastSync?.status === 'failed';
  const label = waiting ? glossary.waitingToConnect : glossary.upToDate;
  const station = status.thisPc?.stationCode;
  const title = `${station ? `${glossary.computerName}: ${station} · ` : ''}${status.pendingCount} change(s) waiting to send`;
  const Tag = clickable ? 'button' : 'span';

  return (
    <Tag
      type={clickable ? 'button' : undefined}
      title={title}
      onClick={clickable ? () => onNavigate('/settings/sync') : undefined}
      {...handlers}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: theme.control.sm,
        padding: '0 10px',
        border: 'none',
        borderRadius: theme.radius.pill,
        backgroundColor: hovered ? c.fillStrong : c.fill,
        color: c.label,
        fontFamily: theme.font.family,
        ...theme.type.footnote,
        fontWeight: theme.font.weightMedium,
        whiteSpace: 'nowrap',
        cursor: clickable ? 'pointer' : 'default',
        transition: `background-color ${theme.motion.fast} ease`,
        flexShrink: 0,
      }}
    >
      <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: theme.radius.pill, backgroundColor: waiting ? c.orange : c.green }} />
      {label}
    </Tag>
  );
}

// Calm two-line brand mark used by both the sidebar and the cashier header.
export function Brand({ name }) {
  const [first, ...rest] = String(name).split(' ');
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...theme.type.headline, color: c.label, whiteSpace: 'nowrap' }}>{first}</div>
      {rest.length > 0 && <div style={{ ...theme.type.footnote, color: c.labelSecondary, whiteSpace: 'nowrap' }}>{rest.join(' ')}</div>}
    </div>
  );
}
