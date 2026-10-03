import React from 'react';
import { Check, CircleAlert, CircleMinus, SearchX } from 'lucide-react';
import theme from '../../../../config/theme';
import glossary from '../../../../config/glossary';
import { Avatar, Badge, Button, DataTable, EmptyState, Icon, Modal, Skeleton } from '../../../../components/ui';
import { formatCurrencyExact } from '../../../../utils/format';
import { SALE_TYPE, formatLocalDateTime } from '../saleLabels';
import { formatQty, packLine, reasonLabel } from './returnUtils';

const c = theme.colors;

const ITEM_COLUMNS = [
  {
    key: 'item',
    label: 'Item',
    render: (l) => (
      <div>
        <div style={{ fontWeight: theme.font.weightSemibold }}>{l.item_name}</div>
        {packLine(l) && <div style={styles.foot}>{packLine(l)}</div>}
      </div>
    ),
  },
  { key: 'quantity', label: 'Qty', numeric: true, width: '80px', render: (l) => formatQty(l.quantity) },
  { key: 'refund_amount', label: 'Value', numeric: true, width: '120px', render: (l) => formatCurrencyExact(l.refund_amount) },
];

// Read-only view of one return. Returns are permanent, so no edit/delete here.
// state: { loading, error: null | 'notFound' | 'failed', data }
export function ReturnDetailSheet({ state, onClose, onRetry, onOpenSale }) {
  const ret = state.data?.return;

  let body;
  if (state.loading) {
    body = <Skeleton lines={6} height="20px" />;
  } else if (state.error === 'notFound') {
    body = <EmptyState icon={SearchX} title="This return can't be opened" message="It may no longer exist." />;
  } else if (state.error) {
    body = (
      <div role="alert" style={styles.errorBox}>
        <Icon icon={CircleAlert} size={18} />
        <span style={{ flex: 1 }}>Couldn't load this return.</span>
        <Button size="sm" variant="tinted" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else {
    body = <ReturnBody data={state.data} onOpenSale={onOpenSale} />;
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={ret ? ret.return_no : 'Return'}
      subtitle={ret ? formatLocalDateTime(ret.created_at) : undefined}
      width={640}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {body}
    </Modal>
  );
}

function ReturnBody({ data, onOpenSale }) {
  const { return: ret, customer, lines } = data;
  const credited = Math.max(0, ret.total_amount - ret.cash_refund_amount);
  const name = customer?.name || glossary.walkIn;
  const type = customer && SALE_TYPE[customer.type];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <div style={styles.line}>
        <span style={{ color: c.labelSecondary }}>Original sale</span>
        <Button variant="plain" size="sm" onClick={() => onOpenSale(ret.sale_id)} style={{ padding: '0 4px' }}>
          {ret.invoice_no}
        </Button>
      </div>

      <div style={styles.line}>
        <Avatar name={name} size={36} />
        <span style={{ fontWeight: theme.font.weightSemibold, color: customer ? c.label : c.labelSecondary }}>{name}</span>
        {type && (
          <Badge tone={type.tone} size="sm">
            {type.label}
          </Badge>
        )}
      </div>

      <div style={styles.tableBox}>
        <DataTable columns={ITEM_COLUMNS} rows={lines} dense maxHeight="240px" />
      </div>

      <div style={styles.totals}>
        <TotalLine label="Value returned" value={formatCurrencyExact(ret.total_amount)} big />
        {ret.cash_refund_amount > 0 && <TotalLine label="Cash back" value={formatCurrencyExact(ret.cash_refund_amount)} />}
        {credited > 0.004 && <TotalLine label={glossary.creditedToAccount} value={formatCurrencyExact(credited)} />}
      </div>

      <div>
        <div style={styles.sectionLabel}>Reason</div>
        <div style={{ ...theme.type.body, color: c.label }}>{reasonLabel(ret.reason)}</div>
        {ret.note && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{ret.note}</div>}
      </div>

      <div style={{ ...styles.line, color: ret.restocked ? c.greenText : c.labelSecondary }}>
        <Icon icon={ret.restocked ? Check : CircleMinus} size={18} />
        <span>{ret.restocked ? 'Items added back to stock' : 'Not added back to stock'}</span>
      </div>

      {ret.processed_by_name && <div style={styles.foot}>Processed by {ret.processed_by_name}</div>}
    </div>
  );
}

function TotalLine({ label, value, big }) {
  const text = big ? theme.type.title2 : theme.type.body;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: theme.spacing.md, color: big ? c.label : c.labelSecondary }}>
      <span style={big ? text : null}>{label}</span>
      <span style={{ ...text, ...theme.font.numeric, fontWeight: big ? theme.font.weightSemibold : undefined, color: c.label, minWidth: '120px', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

const styles = {
  line: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap', ...theme.type.body },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  tableBox: { border: `1px solid ${c.separator}`, borderRadius: theme.radius.md, overflow: 'hidden' },
  totals: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
  sectionLabel: { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary, marginBottom: '2px' },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    backgroundColor: c.redTint,
    color: c.redText,
    ...theme.type.subhead,
  },
};
