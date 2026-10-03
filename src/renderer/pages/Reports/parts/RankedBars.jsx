import React, { memo, useMemo } from 'react';
import theme from '../../../config/theme';
import { formatCurrency, formatCurrencyExact } from '../../../utils/format';
import { SERIES_COLORS } from './reportUtils';

const c = theme.colors;
const MAX_ROWS = 8;

// Horizontal ranked bars: label · bar · amount · % of total. Shows the top 8
// and folds the rest into "Others". Easier to read than a pie.
// items: [{ label, value }]
function RankedBars({ items, color = 'accent', formatValue = formatCurrency, ariaLabel }) {
  const rows = useMemo(() => {
    const sorted = [...(items || [])].sort((a, b) => b.value - a.value);
    if (sorted.length <= MAX_ROWS) return sorted;
    const top = sorted.slice(0, MAX_ROWS - 1);
    const rest = sorted.slice(MAX_ROWS - 1);
    return [...top, { label: `Others (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0), others: true }];
  }, [items]);

  const total = rows.reduce((s, r) => s + Math.max(0, r.value), 0);
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  const fill = SERIES_COLORS[color] || c.accent;

  const summary =
    ariaLabel ||
    rows.map((r) => `${r.label}: ${formatCurrencyExact(r.value)}${total > 0 ? `, ${Math.round((Math.max(0, r.value) / total) * 100)}%` : ''}`).join('; ');

  return (
    <ul style={styles.list} aria-label={summary}>
      {rows.map((r) => {
        const pct = total > 0 ? (Math.max(0, r.value) / total) * 100 : 0;
        const width = max > 0 ? (Math.max(0, r.value) / max) * 100 : 0;
        return (
          <li key={r.label} style={styles.row}>
            <span style={{ ...styles.label, color: r.others ? c.labelSecondary : c.label }} title={r.label}>
              {r.label}
            </span>
            <span style={styles.track} aria-hidden="true">
              <span style={{ ...styles.bar, width: `${width}%`, backgroundColor: fill, opacity: r.others ? 0.45 : 1 }} />
            </span>
            <span style={styles.amount}>{formatValue(r.value)}</span>
            <span style={styles.pct}>{Math.round(pct)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(RankedBars);

const styles = {
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'grid', gridTemplateColumns: 'minmax(90px, 180px) minmax(0, 1fr) auto 44px', alignItems: 'center', gap: theme.spacing.smd },
  label: { ...theme.type.subhead, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  track: { height: '10px', borderRadius: theme.radius.pill, backgroundColor: c.fill, overflow: 'hidden' },
  bar: { display: 'block', height: '100%', borderRadius: theme.radius.pill, transition: `opacity ${theme.motion.fast} ease` },
  amount: { ...theme.type.subhead, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: c.label, textAlign: 'right', whiteSpace: 'nowrap' },
  pct: { ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, textAlign: 'right' },
};
