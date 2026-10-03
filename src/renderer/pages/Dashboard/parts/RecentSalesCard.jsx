import React from 'react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import glossary from '../../../config/glossary';
import { Badge, Button, EmptyState, Skeleton } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';
import { formatCurrencyExact, formatDateTime } from '../../../utils/format';
import { Panel } from './Panel';

const c = theme.colors;
const MAX_ROWS = 6;

// Only shown when a sale isn't fully paid.
const STATUS_BADGE = {
  unpaid: { label: glossary.paidLater, tone: 'orange' },
  partial: { label: glossary.partlyPaid, tone: 'orange' },
};

// Each row opens that sale in Sales History.
export default function RecentSalesCard({ sales, loading, onNavigate }) {
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
    body = sales.slice(0, MAX_ROWS).map((s, i) => (
      <SaleRow key={s.id} sale={s} first={i === 0} onNavigate={onNavigate} />
    ));
  }

  return (
    <Panel title="Recent sales" flush>
      {body}
      {onNavigate && !loading && sales?.length > 0 && (
        <div style={styles.footer}>
          <Button variant="plain" size="sm" onClick={() => onNavigate('/sales')}>
            See all sales
          </Button>
        </div>
      )}
    </Panel>
  );
}

const SaleRow = React.memo(function SaleRow({ sale: s, first, onNavigate }) {
  const onOpen = onNavigate && s.id ? () => onNavigate('/sales', { saleId: s.id }) : undefined;
  const { hovered, handlers } = useInteraction(!onOpen);
  const badge = STATUS_BADGE[s.payment_status];
  const content = (
    <>
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
    </>
  );
  const rowStyle = { ...styles.row, borderTop: first ? 'none' : `1px solid ${c.separator}` };
  if (!onOpen) return <div style={rowStyle}>{content}</div>;
  return (
    <button type="button" onClick={onOpen} {...handlers} style={{ ...rowStyle, ...styles.button, backgroundColor: hovered ? c.surfaceAlt : 'transparent' }}>
      {content}
    </button>
  );
});

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: theme.control.row,
    padding: `8px ${theme.spacing.md}`,
    boxSizing: 'border-box',
  },
  button: { width: '100%', border: 'none', borderRadius: 0, textAlign: 'left', cursor: 'pointer', fontFamily: theme.font.family },
  footer: { display: 'flex', justifyContent: 'center', padding: '6px', borderTop: `1px solid ${c.separator}` },
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
