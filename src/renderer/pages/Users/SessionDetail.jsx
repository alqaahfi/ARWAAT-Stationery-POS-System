import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, ShoppingCart, Activity as ActivityIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, tableStyles, Tr } from '../../components/ui';
import { formatDateTime } from '../../utils/format';

const ACTION_META = {
  login: { label: 'Logged In', icon: LogIn, color: theme.colors.success },
  logout: { label: 'Logged Out', icon: LogOut, color: theme.colors.textSecondary },
  sale_created: { label: 'Sale Created', icon: ShoppingCart, color: theme.colors.primary },
};

function actionMeta(action) {
  return (
    ACTION_META[action] || {
      label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: ActivityIcon,
      color: theme.colors.textSecondary,
    }
  );
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso.replace(' ', 'T') + 'Z');
  const end = new Date(endIso.replace(' ', 'T') + 'Z');
  const ms = end - start;
  if (Number.isNaN(ms) || ms < 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

// The drill-down behind one row of Cashiers > Session Activity — everything
// that cashier did (login, sales made, logout, ...) during that one session,
// in the order it happened.
export default function SessionDetail({ sessionId, onNavigate }) {
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    window.api.sessions.getDetail({ id: sessionId }).then((res) => {
      setData(res);
      setLoading(false);
    });
  }, [sessionId]);

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (loading) return <Card>Loading…</Card>;
  if (!data || !data.success) {
    return (
      <div>
        <PageHeader
          title="Session Detail"
          actions={
            <Button variant="ghost" onClick={() => onNavigate('/cashiers/sessions')}>
              ← Back to Session Activity
            </Button>
          }
        />
        <Card>Session not found.</Card>
      </div>
    );
  }

  const { session, activities } = data;
  const duration = formatDuration(session.login_at, session.ended_at);

  return (
    <div>
      <PageHeader
        title={`Session — ${session.cashier_name}`}
        actions={
          <Button variant="ghost" onClick={() => onNavigate('/cashiers/sessions')}>
            ← Back to Session Activity
          </Button>
        }
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.summaryGrid}>
          <SummaryField label="Cashier" value={`${session.cashier_name} (${session.username})`} />
          <SummaryField label="Login Time" value={formatDateTime(session.login_at)} />
          <SummaryField label="Logout Time" value={session.ended_at ? formatDateTime(session.ended_at) : '—'} />
          <SummaryField label="Duration" value={duration || (session.is_active ? 'In progress' : '—')} />
          <SummaryField
            label="Status"
            value={session.is_active ? 'Active' : 'Ended'}
            valueStyle={{ color: session.is_active ? theme.colors.success : theme.colors.textSecondary }}
          />
          <SummaryField label="Total Activities" value={activities.length} />
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Time</th>
                <th style={tableStyles.th}>Activity</th>
                <th style={tableStyles.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((a) => {
                const meta = actionMeta(a.action);
                const Icon = meta.icon;
                return (
                  <Tr key={a.id}>
                    <td style={{ ...tableStyles.td, whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                    <td style={tableStyles.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: meta.color, fontWeight: theme.font.weightMedium }}>
                        <Icon size={14} />
                        {meta.label}
                      </div>
                    </td>
                    <td style={tableStyles.td}>{a.description || '—'}</td>
                  </Tr>
                );
              })}
              {activities.length === 0 && (
                <tr>
                  <td colSpan={3} style={tableStyles.emptyState}>
                    No activity recorded for this session.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryField({ label, value, valueStyle }) {
  return (
    <div>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={{ ...styles.summaryValue, ...valueStyle }}>{value}</div>
    </div>
  );
}

const styles = {
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: theme.spacing.md,
  },
  summaryLabel: {
    fontSize: theme.font.sizeXs,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  summaryValue: {
    fontSize: theme.font.sizeBase,
    color: theme.colors.textPrimary,
    fontWeight: theme.font.weightMedium,
  },
};
