import React from 'react';
import { Activity, ArrowDown, ArrowUp, Clock, LogIn, LogOut, SearchX, ShoppingCart } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Avatar, Badge, Button, Card, EmptyState, IconButton, IconTile, SearchField, Select, Skeleton } from '../../../components/ui';
import { formatDateTime } from '../../../utils/format';
import { PartyNameCell, RowChevron, listToolbar } from '../../Parties/PartyParts';

const c = theme.colors;

export const SESSION_SORT_OPTIONS = [
  { key: 'login_at', label: 'Signed in' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'activity_count', label: 'Activity' },
];

// Raw activity_log action names -> plain words. Unknown names are shown
// title-cased rather than hidden.
const ACTIONS = {
  login: { label: 'Signed in', icon: LogIn, color: 'green' },
  logout: { label: 'Signed out', icon: LogOut, color: 'gray' },
  sale_created: { label: 'Made a sale', icon: ShoppingCart, color: 'blue' },
};

export function actionMeta(action = '') {
  return (
    ACTIONS[action] || {
      label: String(action).replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
      icon: Activity,
      color: 'gray',
    }
  );
}

export function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso.replace(' ', 'T') + 'Z');
  const end = new Date(endIso.replace(' ', 'T') + 'Z');
  const ms = end - start;
  if (Number.isNaN(ms) || ms < 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours} h ${minutes} min`;
}

function toLocal(iso) {
  const d = iso ? new Date(iso.replace(' ', 'T') + 'Z') : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

function timeOnly(iso) {
  const d = toLocal(iso);
  return d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : iso || '—';
}

function dayOnly(iso) {
  const d = toLocal(iso);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

export function SessionToolbar({ search, onSearch, cashiers, cashierId, onCashierId, sortBy, onSortBy, sortDirection, onToggleDirection }) {
  return (
    <div style={listToolbar}>
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder="Search by name"
        aria-label="Search sessions by cashier"
        style={{ flex: '1 1 220px', maxWidth: '360px' }}
      />
      <Select aria-label="Cashier" value={cashierId} onChange={(e) => onCashierId(e.target.value)} style={{ width: '190px' }}>
        <option value="">All cashiers</option>
        {cashiers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name}
          </option>
        ))}
      </Select>
      <Select aria-label="Sort by" value={sortBy} onChange={(e) => onSortBy(e.target.value)} style={{ width: '170px' }}>
        {SESSION_SORT_OPTIONS.map((opt) => (
          <option key={opt.key} value={opt.key}>
            Sort: {opt.label}
          </option>
        ))}
      </Select>
      <IconButton
        icon={sortDirection === 'asc' ? ArrowUp : ArrowDown}
        label={sortDirection === 'asc' ? 'Oldest first — click to reverse' : 'Newest first — click to reverse'}
        onClick={onToggleDirection}
      />
    </div>
  );
}

function SignedOutCell({ session }) {
  if (session.is_active) {
    return (
      <Badge tone="green" dot>
        {glossary.stillSignedIn}
      </Badge>
    );
  }
  if (session.ended_at) return formatDateTime(session.ended_at);
  // Revoked or expired without a logout — no exact time is stored.
  return <span style={{ color: c.labelSecondary }}>Signed out</span>;
}

export function sessionColumns() {
  return [
    { key: 'cashier', label: glossary.cashier, render: (s) => <PartyNameCell name={s.cashier_name} sub={s.username} /> },
    { key: 'in', label: 'Signed in', width: '170px', render: (s) => formatDateTime(s.login_at) },
    { key: 'out', label: 'Signed out', width: '170px', render: (s) => <SignedOutCell session={s} /> },
    {
      key: 'duration',
      label: 'Duration',
      width: '120px',
      render: (s) => formatDuration(s.login_at, s.ended_at) || <span style={{ color: c.labelTertiary }}>—</span>,
    },
    { key: 'count', label: 'Activity', width: '90px', numeric: true, render: (s) => s.activity_count },
    { key: 'go', label: '', width: '32px', align: 'right', render: () => <RowChevron /> },
  ];
}

export function NoSessions({ filtered, onClear }) {
  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="No sessions match"
        message="Try a different name, or show all cashiers."
        action={
          <Button variant="tinted" onClick={onClear}>
            Clear filters
          </Button>
        }
      />
    );
  }
  return <EmptyState icon={Clock} color="teal" title="No sessions yet" message="Each time a cashier signs in, it shows up here." />;
}

function Stat({ label, children }) {
  return (
    <div>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{label}</div>
      <div style={{ ...theme.type.body, ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightMedium, marginTop: '2px' }}>{children}</div>
    </div>
  );
}

export function SessionHeader({ session, activityCount }) {
  const duration = formatDuration(session.login_at, session.ended_at);
  return (
    <Card padding={theme.spacing.mdl}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
        <Avatar name={session.cashier_name} size={56} />
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
            <h2 style={{ ...theme.type.title2, color: c.label, margin: 0 }}>{session.cashier_name}</h2>
            {session.is_active ? (
              <Badge tone="green" dot>
                {glossary.stillSignedIn}
              </Badge>
            ) : (
              <Badge dot>Signed out</Badge>
            )}
          </div>
          <div style={{ ...theme.type.footnote, fontFamily: theme.font.mono, color: c.labelSecondary, marginTop: '4px' }}>{session.username}</div>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: theme.spacing.md,
          marginTop: theme.spacing.md,
          paddingTop: theme.spacing.md,
          borderTop: `1px solid ${c.separator}`,
        }}
      >
        <Stat label="Signed in">{formatDateTime(session.login_at)}</Stat>
        <Stat label="Signed out">{session.is_active ? '—' : session.ended_at ? formatDateTime(session.ended_at) : 'No time recorded'}</Stat>
        <Stat label="Duration">{duration || '—'}</Stat>
        <Stat label="Things done">{activityCount}</Stat>
      </div>
    </Card>
  );
}

// Vertical timeline: time, icon, plain-words action, optional detail line.
export function ActivityTimeline({ activities }) {
  if (!activities.length) {
    return <EmptyState icon={Activity} title="No activity in this session" message="Nothing was recorded while they were signed in." />;
  }
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {activities.map((a, i) => {
        const meta = actionMeta(a.action);
        const last = i === activities.length - 1;
        const day = dayOnly(a.created_at);
        const newDay = i === 0 || day !== dayOnly(activities[i - 1].created_at);
        return (
          <li key={a.id} style={{ display: 'flex', gap: theme.spacing.smd }}>
            <div style={{ width: '72px', flexShrink: 0, textAlign: 'right', ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, paddingTop: '6px' }}>
              {newDay && <div style={{ fontWeight: theme.font.weightSemibold, color: c.label }}>{day}</div>}
              {timeOnly(a.created_at)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <IconTile icon={meta.icon} color={meta.color} size="md" variant="soft" />
              {!last && <div aria-hidden="true" style={{ flex: 1, width: '2px', minHeight: '14px', backgroundColor: c.separator, margin: '4px 0' }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: '5px', paddingBottom: last ? 0 : theme.spacing.md }}>
              <div style={{ ...theme.type.body, fontWeight: theme.font.weightMedium, color: c.label }}>{meta.label}</div>
              {a.description && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' }}>{a.description}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function SessionDetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <Card>
        <Skeleton width="40%" height="20px" style={{ marginBottom: theme.spacing.md }} />
        <Skeleton lines={2} />
      </Card>
      <Card>
        <Skeleton lines={5} height="18px" />
      </Card>
    </div>
  );
}
