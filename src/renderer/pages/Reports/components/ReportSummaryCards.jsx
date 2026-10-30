import React, { memo } from 'react';
import theme from '../../../config/theme';
import { IconTile } from '../../../components/ui';
import { formatCurrencyCompact, formatCount } from '../../../utils/format';
import { useNarrow } from '../parts/reportUtils';

const c = theme.colors;

function formatValue(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'currency') return formatCurrencyCompact(value);
  if (format === 'number') return formatCount(value);
  return String(value);
}

// Headline numbers in Home's StatTile style. Accepts the report envelope's
// summary items ({ label, value, format }) plus optional presentation keys:
//   display     — already-formatted value (overrides value/format)
//   footnote    — one line under the value
//   valueColor  — a theme color token name (e.g. 'greenText')
//   icon        — an appIcons entry ({ icon, color })
// At most 4 cards per row (2 per row below 900px).
export default function ReportSummaryCards({ items }) {
  const narrow = useNarrow();
  if (!items || items.length === 0) return null;
  const perRow = narrow ? Math.min(items.length, 2) : Math.min(items.length, 4);
  return (
    <div style={{ ...styles.row, gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <SummaryCard key={item.label} item={item} />
      ))}
    </div>
  );
}

const SummaryCard = memo(function SummaryCard({ item }) {
  const value = item.display ?? formatValue(item.value, item.format);
  return (
    <div style={styles.card}>
      <div style={styles.top}>
        {item.icon && <IconTile {...item.icon} size="sm" variant="soft" />}
        <span style={styles.label}>{item.label}</span>
      </div>
      <div style={{ ...styles.value, color: (item.valueColor && c[item.valueColor]) || c.label }} title={typeof value === 'string' ? value : undefined}>
        {value}
      </div>
      {item.footnote && <div style={styles.footnote}>{item.footnote}</div>}
    </div>
  );
});

const styles = {
  row: { display: 'grid', gap: theme.spacing.md },
  card: {
    minWidth: 0,
    padding: theme.spacing.md,
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    border: `1px solid ${c.separator}`,
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.family,
  },
  top: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 },
  label: { ...theme.type.subhead, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  value: {
    fontSize: '28px',
    fontWeight: theme.font.weightBold,
    lineHeight: '34px',
    letterSpacing: '-0.02em',
    ...theme.font.numeric,
    margin: '8px 0 2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footnote: { ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
