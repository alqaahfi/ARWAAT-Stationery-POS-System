import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Skeleton } from '../../../components/ui';
import { Panel } from './Panel';

const c = theme.colors;

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

// Sessions come from this computer's own database, so the list can't see
// anyone signed in on another computer — the footnote says so plainly.
export default function SignedInCard({ sessions }) {
  let body;
  if (!sessions) {
    body = <Skeleton lines={2} height="28px" />;
  } else if (!sessions.length) {
    body = <div style={styles.empty}>No one else is signed in.</div>;
  } else {
    body = sessions.map((s) => {
      const isOwner = s.role === 'admin';
      return (
        <div key={s.id} style={styles.row}>
          <span aria-hidden="true" style={styles.avatar}>
            {initials(s.full_name)}
          </span>
          <div style={styles.main}>
            <div style={styles.name}>{s.full_name}</div>
            {s.stationCode && <div style={styles.meta}>{s.stationCode}</div>}
          </div>
          <Badge tone={isOwner ? 'blue' : 'neutral'} size="sm">
            {isOwner ? glossary.owner : glossary.cashier}
          </Badge>
        </div>
      );
    });
  }

  return (
    <Panel title="Signed in now">
      {body}
      <div style={styles.note}>Shows people signed in on this computer only.</div>
    </Panel>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, padding: '6px 0' },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: theme.radius.pill,
    backgroundColor: c.fill,
    color: c.labelSecondary,
    ...theme.type.footnote,
    fontWeight: theme.font.weightSemibold,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  main: { flex: 1, minWidth: 0 },
  name: { ...theme.type.body, color: c.label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta: { ...theme.type.footnote, color: c.labelSecondary },
  empty: { ...theme.type.subhead, color: c.labelSecondary, padding: '4px 0' },
  note: { ...theme.type.footnote, color: c.labelTertiary, marginTop: theme.spacing.sm },
};
