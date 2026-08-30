import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import theme from '../../config/theme';
import StatTile from '../../components/StatTile';
import { formatCount, formatCurrency, formatDateTime } from '../../utils/format';

const PERIODS = [7, 30, 90];

// A. Essential stats, B. an interactive revenue graph, C. active users — the
// three sections this page was rebuilt around. `onNavigate` lets the stat
// cards and the chart's bar-click drill into the pages they summarize.
export default function Overview({ onNavigate }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState(30);
  const [trend, setTrend] = useState(null);
  const [sessions, setSessions] = useState(null);

  useEffect(() => {
    let cancelled = false;
    window.api.dashboard
      .getSummary()
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load dashboard data.');
      });
    window.api.dashboard.getActiveSessions().then((res) => {
      if (!cancelled) setSessions(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.api.dashboard.getRevenueTrend({ days: period }).then(setTrend);
  }, [period]);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!summary) return <div style={styles.loading}>Loading dashboard…</div>;

  return (
    <div>
      {/* A. Essential stats */}
      <div style={styles.grid}>
        <StatTile
          label="Today's Revenue"
          value={formatCurrency(summary.todaySalesTotal)}
          accent={theme.colors.accentBlue}
        />
        <StatTile
          label="Today's Sales Count"
          value={formatCount(summary.todaySalesCount)}
          accent={theme.colors.accentGreen}
        />
        <ClickableTile onClick={() => onNavigate?.('/products/low-stock')}>
          <StatTile label="Low Stock Count" value={formatCount(summary.lowStockCount)} hint="Click to view" accent={theme.colors.accentAmber} />
        </ClickableTile>
        <ClickableTile onClick={() => onNavigate?.('/products/dead-stock')}>
          <StatTile label="Dead Stock Count" value={formatCount(summary.deadStockCount)} hint="Click to view" accent={theme.colors.accentPurple} />
        </ClickableTile>
      </div>

      {/* B. Interactive revenue graph */}
      <div style={styles.chartCard}>
        <div style={styles.chartHeader}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Revenue Trend</h4>
          <div style={styles.periodToggle}>
            {PERIODS.map((p) => (
              <button
                key={p}
                style={{ ...styles.periodBtn, ...(period === p ? styles.periodBtnActive : {}) }}
                onClick={() => setPeriod(p)}
              >
                {p} days
              </button>
            ))}
          </div>
        </div>
        <span style={styles.chartHint}>Click a bar to view that day in the Sales Report</span>
        {trend ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
              <YAxis tick={{ fontSize: 11, fill: theme.colors.textSecondary }} />
              <Tooltip />
              <Bar
                dataKey="revenue"
                fill={theme.colors.accentBlue}
                radius={[4, 4, 0, 0]}
                cursor="pointer"
                onClick={(entry) => {
                  const day = entry?.payload?.date ?? entry?.date;
                  if (day) onNavigate?.('/reports/sales', { date: day });
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ color: theme.colors.textSecondary, padding: '24px' }}>Loading…</div>
        )}
      </div>

      {/* C. Active users */}
      <div style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>Active Users</div>
          <div style={styles.limitationNote}>
            Shows sessions on this PC only. Full multi-PC visibility requires the Sync module's live connection status, not
            yet built.
          </div>
        </div>
        {!sessions ? (
          <div style={styles.emptyState}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={styles.emptyState}>No active sessions.</div>
        ) : (
          <div style={styles.tableScroll}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Station</th>
                  <th style={styles.th}>Logged In Since</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{s.full_name}</td>
                    <td style={{ ...styles.td, textTransform: 'capitalize' }}>{s.role}</td>
                    <td style={styles.td}>{s.stationCode || '—'}</td>
                    <td style={{ ...styles.td, color: theme.colors.textSecondary }}>{formatDateTime(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ClickableTile({ onClick, children }) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  loading: { color: theme.colors.textSecondary, fontFamily: theme.font.family, padding: '24px' },
  error: { color: theme.colors.danger, fontFamily: theme.font.family, padding: '24px' },
  chartCard: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    fontFamily: theme.font.family,
  },
  chartHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chartHint: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, display: 'block', marginBottom: '8px' },
  periodToggle: { display: 'flex', gap: '6px' },
  periodBtn: {
    padding: '6px 12px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    cursor: 'pointer',
  },
  periodBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary, color: theme.colors.primaryText },
  tableCard: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    fontFamily: theme.font.family,
    overflow: 'hidden',
  },
  tableHeader: {
    padding: '16px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  limitationNote: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, fontWeight: theme.font.weightNormal, marginTop: '4px' },
  emptyState: { color: theme.colors.textSecondary, padding: '32px 20px', textAlign: 'center', fontSize: theme.font.sizeBase },
  tableScroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.sizeSm, minWidth: '480px' },
  th: {
    textAlign: 'left',
    color: theme.colors.textSecondary,
    fontWeight: theme.font.weightSemibold,
    padding: '10px 20px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: '#f8fafc',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 20px',
    color: theme.colors.textPrimary,
    borderBottom: `1px solid ${theme.colors.border}`,
    whiteSpace: 'nowrap',
  },
};
