import React from 'react';
import theme from '../../../config/theme';
import StatTile from '../../../components/StatTile';
import { formatCell } from '../utils/formatCell';

const ACCENT_MAP = {
  blue: theme.colors.accentBlue,
  green: theme.colors.accentGreen,
  amber: theme.colors.accentAmber,
  purple: theme.colors.accentPurple,
};

// Renders one StatTile per summary item — same card the Dashboard uses, so a
// report's headline numbers look like they belong to the same app.
export default function ReportSummaryCards({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={styles.row}>
      {items.map((item, i) => (
        <StatTile key={i} label={item.label} value={formatCell(item.value, item.format)} accent={ACCENT_MAP[item.accentKey]} />
      ))}
    </div>
  );
}

const styles = {
  row: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.md },
};
