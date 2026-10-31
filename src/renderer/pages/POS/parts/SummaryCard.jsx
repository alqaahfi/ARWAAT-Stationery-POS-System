import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { formatCurrency } from '../../../utils/format';
import { Eye } from 'lucide-react';
import { Badge, Button, Card, Kbd } from '../../../components/ui';
import { InlineMessage, Money, c, keepFocus } from './common';

const FORMAT_LABELS = { 'wholesale-a4': 'A4 invoice', 'retail-thermal': 'Small receipt', 'none': 'No receipt' };

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
  previousBalance,
  newBalance,
  editingInvoiceNo,
  onPreview,
}) {
  const saleType = customer ? customer.customer_type : 'retail';
  const paying = stage === 'format' || stage === 'payment';

  return (
    <Card padding={theme.spacing.mdl} style={styles.card}>
      {editingInvoiceNo && (
        <InlineMessage tone="info" style={{ marginTop: 0, marginBottom: theme.spacing.smd }}>
          Editing bill {editingInvoiceNo}
        </InlineMessage>
      )}
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

      {customer && previousBalance !== null && previousBalance !== undefined && (
        <div style={styles.balances} aria-live="polite">
          <BalanceBox label="Previous balance" value={previousBalance} />
          <BalanceBox label="New balance" value={newBalance} emphasis />
        </div>
      )}

      <div style={styles.divider} />
      <Line label="Items" value={itemCount} />
      <Line label="Subtotal" value={formatCurrency(subtotal)} />
      {discountAmount > 0 && <Line label="Discount" value={`− ${formatCurrency(discountAmount)}`} />}

      <div style={styles.divider} />
      <div style={styles.label}>Total</div>
      <Money value={formatCurrency(total)} style={styles.total} />

      {onPreview && (stage === 'discount' || paying) && itemCount > 0 && (
        <div style={{ marginTop: theme.spacing.md }} onMouseDown={keepFocus}>
          <Button variant="secondary" fullWidth icon={Eye} tabIndex={-1} onClick={onPreview}>
            Preview bill (not saved) <Kbd>F8</Kbd>
          </Button>
        </div>
      )}

      {paying && (
        <>
          <div style={styles.divider} />
          <Line label="Receipt" value={FORMAT_LABELS[printFormat]} />
          {stage === 'payment' && (
            <>
              <Line label="Amount received" value={formatCurrency(amountReceived)} />
              {changeDue > 0 && <Line label="Change" value={formatCurrency(changeDue)} color={c.greenText} strong />}
              {balanceDue > 0 && <Line label="Balance due" value={formatCurrency(balanceDue)} color={c.orangeText} strong />}
            </>
          )}
        </>
      )}
    </Card>
  );
}

// Positive = the customer owes the shop (orange); negative = they are in credit (green).
function BalanceBox({ label, value, emphasis }) {
  const color = value > 0 ? c.orangeText : value < 0 ? c.greenText : c.label;
  return (
    <div style={{ ...styles.balanceBox, backgroundColor: emphasis ? c.accentTint : c.surfaceAlt }}>
      <div style={styles.label}>{label}</div>
      <Money value={formatCurrency(Math.abs(value))} style={{ display: 'block', ...theme.type.title2, fontWeight: theme.font.weightBold, color }} />
      <div style={{ ...theme.type.caption, color }}>{value > 0 ? 'Owes shop' : value < 0 ? 'In credit' : 'Settled'}</div>
    </div>
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
  balances: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.smd },
  balanceBox: { flex: 1, minWidth: 0, padding: theme.spacing.smd, borderRadius: theme.radius.md, border: `1px solid ${c.separator}` },
  divider: { height: '1px', backgroundColor: c.separator, margin: `${theme.spacing.smd} 0` },
  total: { display: 'block', fontSize: '36px', lineHeight: '44px', fontWeight: theme.font.weightBold, letterSpacing: '-0.02em', color: c.label },
};
