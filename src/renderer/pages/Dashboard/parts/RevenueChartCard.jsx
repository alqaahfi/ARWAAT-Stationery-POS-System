import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Button, EmptyState, SegmentedControl, Skeleton } from '../../../components/ui';
import { formatCurrency, formatCurrencyExact } from '../../../utils/format';
import { Panel } from './Panel';

const c = theme.colors;
const CHART_HEIGHT = 240;

// Same day counts dashboard:get-revenue-trend accepts.
const PERIODS = [
  { value: 7, label: '7 days', footnote: 'Last 7 days' },
  { value: 30, label: '30 days', footnote: 'Last 30 days' },
  { value: 90, label: '3 months', footnote: 'Last 3 months' },
];

// Trend dates are "YYYY-MM-DD"; read them as local calendar days.
function parseDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  return new Date(y, m - 1, d);
}
const shortDay = (key) => parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDay = (key) => parseDay(key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });

function compactNumber(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${+(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export default function RevenueChartCard({ onNavigate }) {
  const [period, setPeriod] = useState(30);
  // Results cached per period so switching back shows instantly while it refreshes.
  const [byPeriod, setByPeriod] = useState({});
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setError(false);
    window.api.dashboard
      .getRevenueTrend({ days: period })
      .then((rows) => {
        if (alive) setByPeriod((prev) => ({ ...prev, [period]: Array.isArray(rows) ? rows : [] }));
      })
      .catch(() => {
        if (alive) setError(true);
      });
    return () => {
      alive = false;
    };
  }, [period, attempt]);

  const trend = byPeriod[period];
  const total = useMemo(() => (trend || []).reduce((sum, d) => sum + (Number(d.revenue) || 0), 0), [trend]);
  const hasSales = (trend || []).some((d) => Number(d.revenue) > 0);
  const footnote = PERIODS.find((p) => p.value === period).footnote;

  // Same drill-down as before: open the Sales Report filtered to that day.
  const onBarClick = useCallback(
    (entry) => {
      const day = entry?.payload?.date ?? entry?.date;
      if (day) onNavigate?.('/reports/sales', { date: day });
    },
    [onNavigate]
  );

  let body;
  if (error && !trend) {
    body = (
      <div style={styles.center}>
        <div style={styles.errorText}>Couldn't load your sales for this period.</div>
        <Button variant="tinted" size="sm" onClick={() => setAttempt((a) => a + 1)}>
          Try again
        </Button>
      </div>
    );
  } else if (!trend) {
    body = <Skeleton height={`${CHART_HEIGHT}px`} radius={theme.radius.md} />;
  } else if (!hasSales) {
    body = (
      <div style={styles.center}>
        <EmptyState {...appIcons.reports} title="No sales in this period yet" style={{ padding: 0 }} />
      </div>
    );
  } else {
    body = <TrendChart data={trend} onBarClick={onBarClick} />;
  }

  return (
    <Panel
      title="Sales"
      right={
        <SegmentedControl
          size="sm"
          label="Period"
          options={PERIODS.map(({ value, label }) => ({ value, label }))}
          value={period}
          onChange={setPeriod}
        />
      }
    >
      <div style={styles.total}>{trend ? formatCurrency(total) : <Skeleton width="140px" height="30px" />}</div>
      <div style={styles.footnote}>{footnote}</div>
      <div style={{ marginTop: theme.spacing.md }}>{body}</div>
    </Panel>
  );
}

// Memoized so the chart only re-renders when its data changes.
const TrendChart = memo(function TrendChart({ data, onBarClick }) {
  const lastIndex = data.length - 1;
  const tick = { fontSize: 11, fill: c.labelSecondary, fontFamily: theme.font.family };
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.separator} />
        <XAxis
          dataKey="date"
          tickFormatter={shortDay}
          tick={tick}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis tickFormatter={compactNumber} tick={tick} axisLine={false} tickLine={false} width={44} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: c.fill }} isAnimationActive={false} />
        <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={28} cursor="pointer" onClick={onBarClick}>
          {data.map((d, i) => (
            <Cell key={d.date} fill={c.accent} fillOpacity={i === lastIndex ? 1 : 0.55} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipDate}>{longDay(d.date)}</div>
      <div style={styles.tooltipAmount}>{formatCurrencyExact(d.revenue)}</div>
      <div style={styles.tooltipHint}>Click to see these sales</div>
    </div>
  );
}

const styles = {
  total: {
    fontSize: '30px',
    fontWeight: theme.font.weightBold,
    lineHeight: '36px',
    letterSpacing: '-0.02em',
    color: c.label,
    ...theme.font.numeric,
  },
  footnote: { ...theme.type.footnote, color: c.labelSecondary },
  center: {
    height: `${CHART_HEIGHT}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.smd,
  },
  errorText: { ...theme.type.subhead, color: c.redText },
  tooltip: {
    backgroundColor: c.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.popover,
    padding: '8px 12px',
    fontFamily: theme.font.family,
    minWidth: '140px',
  },
  tooltipDate: { ...theme.type.footnote, color: c.labelSecondary },
  tooltipAmount: { ...theme.type.headline, color: c.label, ...theme.font.numeric, marginTop: '2px' },
  tooltipHint: { ...theme.type.caption, color: c.labelTertiary, marginTop: '4px' },
};
