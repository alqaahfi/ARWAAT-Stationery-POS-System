import React from 'react';
import theme from '../../../config/theme';
import { Card } from '../../../components/ui';

const c = theme.colors;

// White card with a headline title, an optional hint/action on the right,
// and the chart (or ranked bars) below.
export default function ChartCard({ title, right, children }) {
  return (
    <Card>
      <div style={styles.header}>
        <h2 style={styles.title}>{title}</h2>
        {right && <div style={styles.right}>{right}</div>}
      </div>
      {children}
    </Card>
  );
}

const styles = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.smd, flexWrap: 'wrap' },
  title: { ...theme.type.headline, color: c.label, margin: 0 },
  right: { ...theme.type.footnote, color: c.labelSecondary, display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
};
