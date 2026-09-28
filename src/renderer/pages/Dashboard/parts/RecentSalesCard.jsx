import React from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import glossary from '../../../config/glossary';
import { Badge, EmptyState, Skeleton } from '../../../components/ui';
import { formatCurrencyExact, formatDateTime } from '../../../utils/format';
import { Panel } from './Panel';

const c = theme.colors;
const MAX_ROWS = 6;

// Only shown when a sale isn't fully paid.
const STATUS_BADGE = {
  unpaid: { label: glossary.paidLater, tone: 'orange' },
  partial: { label: glossary.partlyPaid, tone: 'orange' },
};

// Plain rows for now — Sales History (and row links) arrive in Phase 10.
export default function RecentSalesCard({ sales, loading }) {
  let body;
  if (loading) {
    body = (
      <div style={{ padding: theme.spacing.md }}>
        <Skeleton lines={4} height="28px" />
      </div>
    );
  } else if (!sales?.length) {
    body = <EmptyState {...appIcons.sales} title="No sales yet" style={{ padding: '24px' }} />;
  } else {
    body = sales.slice(0, MAX_ROWS).map((s, i) => {
      const badge = STATUS_BADGE[s.payment_status];
      return (
        <div key={s.id} style={{ ...styles.row, borderTop: i > 0 ? `1px solid ${c.separator}` : 'none' }}>
          <div style={styles.main}>
            <div style={styles.invoiceLine}>
              <span style={styles.invoice}>{s.invoice_no}</span>
              {badge && (
                <Badge tone={badge.tone} size="sm">
                  {badge.label}
                </Badge>
              )}
            </div>
            <div style={styles.meta}>
              {s.customer_name || glossary.walkIn} · {formatDateTime(s.created_at)}
            </div>
          </div>
          <div style={styles.amount}>{formatCurrencyExact(s.total_amount)}</div>
        </div>
      );
    });
  }

  return (
    <Panel title="Recent sales" flush>
      {body}
    </Panel>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.control.row,
    padding: `8px ${theme.spacing.md}`,
    boxSizing: 'border-box',
  },
  main: { flex: 1, minWidth: 0 },
  invoiceLine: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  invoice: { ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label },
  meta: {
    ...theme.type.footnote,
    color: c.labelSecondary,
    marginTop: '1px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  amount: { ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label, ...theme.font.numeric, whiteSpace: 'nowrap' },
};
