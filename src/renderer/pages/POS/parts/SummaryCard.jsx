import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { formatCurrency } from '../../../utils/format';
import { Badge, Card } from '../../../components/ui';
import { InlineMessage, Money, c } from './common';

const FORMAT_LABELS = { 'wholesale-a4': 'A4 invoice', 'retail-thermal': 'Small receipt' };
const METHOD_LABELS = { cash: 'Cash', bank: 'Bank', other: 'Other' };

export default function SummaryCard({
  customer,
  customerNote,
  itemCount,
  subtotal,
  discountAmount,
  total,
  stage,
  printFormat,
  paymentMethod,
  amountReceived,
  changeDue,
  balanceDue,
}) {
  const saleType = customer ? customer.customer_type : 'retail';
  const paying = stage === 'format' || stage === 'payment';

  return (
    <Card padding={theme.spacing.mdl} style={styles.card}>
      <div style={styles.label}>Customer</div>
      <div style={styles.customer}>
        <span style={{ ...theme.type.headline, color: c.label, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {customer ? customer.name : glossary.walkIn}
        </span>
        <Badge tone={saleType === 'wholesale' ? 'purple' : 'blue'}>{saleType === 'wholesale' ? 'Wholesale' : 'Retail'}</Badge>
      </div>
      {customerNote && stage !== 'customer' && (
        <InlineMessage tone="info" style={{ ...theme.type.footnote }}>
          {customerNote}
        </InlineMessage>
      )}

      <div style={styles.divider} />
      <Line label="Items" value={itemCount} />
      <Line label="Subtotal" value={formatCurrency(subtotal)} />
      {discountAmount > 0 && <Line label="Discount" value={`− ${formatCurrency(discountAmount)}`} />}

      <div style={styles.divider} />
      <div style={styles.label}>Total</div>
      <Money value={formatCurrency(total)} style={styles.total} />

      {paying && (
        <>
          <div style={styles.divider} />
          <Line label="Receipt" value={FORMAT_LABELS[printFormat]} />
          {stage === 'payment' && (
            <>
              <Line label="Payment method" value={METHOD_LABELS[paymentMethod]} />
              <Line label="Amount received" value={formatCurrency(amountReceived)} />
              {changeDue > 0 && <Line label="Change to give back" value={formatCurrency(changeDue)} color={c.greenText} strong />}
              {balanceDue > 0 && <Line label="Balance due" value={formatCurrency(balanceDue)} color={c.orangeText} strong />}
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Line({ label, value, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm, padding: '4px 0', ...theme.type.body }}>
      <span style={{ color: color || c.labelSecondary, fontWeight: strong ? theme.font.weightSemibold : undefined }}>{label}</span>
      <Money value={value} style={{ color: color || c.label, fontWeight: strong ? theme.font.weightSemibold : theme.font.weightMedium, textAlign: 'right' }} />
    </div>
  );
}

const styles = {
  card: { width: '340px', flexShrink: 0, boxSizing: 'border-box', overflowY: 'auto', alignSelf: 'stretch' },
  label: { ...theme.type.footnote, color: c.labelSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
  customer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  divider: { height: '1px', backgroundColor: c.separator, margin: `${theme.spacing.smd} 0` },
  total: { display: 'block', fontSize: '36px', lineHeight: '44px', fontWeight: theme.font.weightBold, letterSpacing: '-0.02em', color: c.label },
};
