import React, { memo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import theme from '../../../config/theme';
import { formatCurrencyExact } from '../../../utils/format';
import { SERIES_COLORS, compactNumber } from './reportUtils';

const c = theme.colors;
const TICK = { fontSize: 11, fill: c.labelSecondary, fontFamily: theme.font.family };

// Bar chart in the Home chart's style: rounded tops, horizontal gridlines
// only, no axis lines, compact ticks, popover-style tooltip.
// series: [{ key, label, color }] — color is a SERIES_COLORS name.
// stacked: stack the series instead of grouping them.
// selectedX: highlights one x value (others fade). onBarClick(xValue).
function ReportBarChart({ data, xKey, series, stacked = false, formatX = (v) => v, formatTooltipX, onBarClick, selectedX, height = 240, ariaLabel, hint }) {
  const single = series.length === 1;
  return (
    <div role="img" aria-label={ariaLabel}>
      {!single && (
        <div style={styles.legend} aria-hidden="true">
          {series.map((s) => (
            <span key={s.key} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, backgroundColor: SERIES_COLORS[s.color] || c.accent }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={c.separator} />
          <XAxis dataKey={xKey} tickFormatter={formatX} tick={TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={20} />
          <YAxis tickFormatter={compactNumber} tick={TICK} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            content={<ChartTooltip series={series} xKey={xKey} formatX={formatTooltipX || formatX} hint={onBarClick ? hint : null} />}
            cursor={{ fill: c.fill }}
            isAnimationActive={false}
          />
          {series.map((s, i) => {
            const color = SERIES_COLORS[s.color] || c.accent;
            const top = !stacked || i === series.length - 1;
            return (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? 'stack' : undefined}
                fill={color}
                radius={top ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={single ? 28 : 18}
                isAnimationActive={false}
                cursor={onBarClick ? 'pointer' : undefined}
                onClick={
                  onBarClick
                    ? (entry) => {
                        // recharts passes the datum directly or under .payload.
                        const x = entry?.payload?.[xKey] ?? entry?.[xKey];
                        if (x != null) onBarClick(x);
                      }
                    : undefined
                }
              >
                {selectedX != null &&
                  data.map((d) => <Cell key={d[xKey]} fill={color} fillOpacity={d[xKey] === selectedX ? 1 : 0.35} />)}
              </Bar>
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, payload, series, xKey, formatX, hint }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipTitle}>{formatX(d[xKey])}</div>
      {series.map((s) => (
        <div key={s.key} style={styles.tooltipRow}>
          {series.length > 1 && <span style={{ ...styles.legendDot, backgroundColor: SERIES_COLORS[s.color] || c.accent }} />}
          {series.length > 1 && <span style={styles.tooltipLabel}>{s.label}</span>}
          <span style={styles.tooltipAmount}>{formatCurrencyExact(d[s.key])}</span>
        </div>
      ))}
      {hint && <div style={styles.tooltipHint}>{hint}</div>}
    </div>
  );
}

export default memo(ReportBarChart);

const styles = {
  legend: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md, marginBottom: theme.spacing.sm },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: '6px', ...theme.type.footnote, color: c.labelSecondary },
  legendDot: { width: '8px', height: '8px', borderRadius: theme.radius.pill, flexShrink: 0, display: 'inline-block' },
  tooltip: {
    backgroundColor: c.surface,
    borderRadius: theme.radius.md,
    boxShadow: theme.shadow.popover,
    padding: '8px 12px',
    fontFamily: theme.font.family,
    minWidth: '150px',
  },
  tooltipTitle: { ...theme.type.footnote, color: c.labelSecondary, marginBottom: '2px' },
  tooltipRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' },
  tooltipLabel: { ...theme.type.footnote, color: c.labelSecondary, flex: 1 },
  tooltipAmount: { ...theme.type.headline, color: c.label, ...theme.font.numeric, marginLeft: 'auto' },
  tooltipHint: { ...theme.type.caption, color: c.labelTertiary, marginTop: '4px' },
};
