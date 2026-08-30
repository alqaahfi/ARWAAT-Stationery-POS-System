import React from 'react';
import theme from '../../../config/theme';
import { Button, Select, Banner } from '../../../components/ui';
import { formatCurrency } from '../../../utils/format';

const STATUS_LABEL = { paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid' };
const STATUS_COLOR = { paid: theme.colors.success, partial: theme.colors.warning, unpaid: theme.colors.danger };

export default function PaymentPanel({
  subtotal,
  discountMode,
  discountInput,
  onDiscountModeChange,
  onDiscountInputChange,
  discountCap,
  discountExceedsCap,
  discountAmount,
  totalAmount,
  paidAmount,
  onPaidAmountChange,
  paymentMethod,
  onPaymentMethodChange,
  balanceDue,
  paymentStatus,
  customer,
  onComplete,
  completing,
  disableComplete,
  error,
}) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>Payment</div>

      <Row label="Subtotal" value={formatCurrency(subtotal)} />

      <div style={styles.discountRow}>
        <div style={styles.fieldLabel}>Discount</div>
        <div style={styles.discountControls}>
          <select style={styles.modeSelect} value={discountMode} onChange={(e) => onDiscountModeChange(e.target.value)}>
            <option value="percentage">%</option>
            <option value="fixed">Rs</option>
          </select>
          <input type="number" style={styles.discountInput} value={discountInput} onChange={(e) => onDiscountInputChange(e.target.value)} />
        </div>
      </div>
      {discountCap !== null && <div style={styles.helperText}>Your discount limit: {discountCap}%</div>}
      {discountExceedsCap && <Banner>Discount exceeds your allowed limit of {discountCap}%.</Banner>}

      <Row label="Discount Amount" value={`− ${formatCurrency(discountAmount)}`} />
      <Row label="Total" value={formatCurrency(totalAmount)} bold />

      <div style={styles.field}>
        <div style={styles.fieldLabel}>Amount Paid</div>
        <input type="number" style={styles.amountInput} value={paidAmount} onChange={(e) => onPaidAmountChange(e.target.value)} />
      </div>

      {Number(paidAmount) > 0 && (
        <div style={styles.field}>
          <div style={styles.fieldLabel}>Payment Method</div>
          <Select value={paymentMethod} onChange={(e) => onPaymentMethodChange(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="other">Other</option>
          </Select>
        </div>
      )}

      <Row label="Balance Due" value={formatCurrency(balanceDue)} bold />

      <div style={styles.statusRow}>
        <span style={{ color: STATUS_COLOR[paymentStatus] }}>● {STATUS_LABEL[paymentStatus]}</span>
      </div>

      {balanceDue > 0 && !customer && <Banner>Select a customer to sell on credit — walk-in sales must be paid in full.</Banner>}

      <Banner>{error}</Banner>

      <Button style={{ width: '100%', marginTop: '16px', padding: '16px', fontSize: theme.font.sizeMd }} onClick={onComplete} disabled={disableComplete || completing}>
        {completing ? 'Completing…' : 'Complete Sale'}
      </Button>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        color: bold ? theme.colors.textPrimary : theme.colors.textSecondary,
        fontWeight: bold ? theme.font.weightSemibold : theme.font.weightNormal,
        fontSize: bold ? theme.font.sizeMd : theme.font.sizeBase,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    fontFamily: theme.font.family,
    height: '100%',
    overflowY: 'auto',
  },
  header: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  discountRow: { padding: '8px 0', borderTop: `1px solid ${theme.colors.border}` },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, marginBottom: '6px' },
  discountControls: { display: 'flex', gap: '8px' },
  modeSelect: {
    padding: '8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
  },
  discountInput: {
    flex: 1,
    padding: '8px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
  },
  helperText: { color: theme.colors.textSecondary, fontSize: '11px', marginTop: '4px' },
  field: { padding: '10px 0', borderTop: `1px solid ${theme.colors.border}` },
  amountInput: {
    width: '100%',
    padding: '10px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeMd,
    boxSizing: 'border-box',
  },
  statusRow: { padding: '8px 0', fontSize: theme.font.sizeBase, fontWeight: theme.font.weightSemibold },
};
