import React from 'react';
import { Banknote, Building2, Ellipsis } from 'lucide-react';
import theme from '../../config/theme';
import { formatCurrency } from '../../utils/format';
import { Badge, Banner, Button, Card, Checkbox, NumberInput, SegmentedControl } from '../ui';

const c = theme.colors;

const DISCOUNT_MODES = [
  { value: 'percentage', label: '%' },
  { value: 'amount', label: 'Amount' },
];
const METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank', label: 'Bank', icon: Building2 },
  { value: 'other', label: 'Other', icon: Ellipsis },
];
const FORMATS = [
  { value: 'retail-thermal', label: 'Small receipt' },
  { value: 'wholesale-a4', label: 'A4 invoice' },
];

// The right-hand side of both quick bills: discount, live totals, payment and
// the Save button. Sale and Purchase differ only in the wording and in the few
// sale-only rows (receipt choice, balance on receipt).
export default function BillSummary({
  kind,
  partyName,
  partyBadge,
  totals,
  previousBalance,
  newBalance,
  discountMode,
  onDiscountMode,
  discountInput,
  onDiscountInput,
  discountCap,
  discountError,
  paidInput,
  onPaidInput,
  method,
  onMethod,
  printFormat,
  onPrintFormat,
  showDuesOption,
  showDues,
  onShowDues,
  itemCount,
  error,
  saving,
  canSave,
  onSave,
}) {
  const isPurchase = kind === 'purchase';
  const { subtotal, discountAmount, total, paid, changeDue, balanceDue, freeUnits } = totals;

  return (
    <Card padding={theme.spacing.md} style={styles.card}>
      <div style={styles.label}>{isPurchase ? 'Supplier' : 'Customer'}</div>
      <div style={styles.partyRow}>
        <span style={{ ...theme.type.headline, color: c.label, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partyName}</span>
        {partyBadge}
      </div>

      {previousBalance !== null && previousBalance !== undefined && (
        <div style={styles.balances} aria-live="polite">
          <BalanceBox label="Previous balance" value={previousBalance} isPurchase={isPurchase} />
          <BalanceBox label="New balance" value={newBalance} isPurchase={isPurchase} emphasis />
        </div>
      )}

      <div style={styles.divider} />
      <div style={styles.label}>Discount</div>
      <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
        <SegmentedControl label="Discount type" options={DISCOUNT_MODES} value={discountMode} onChange={onDiscountMode} />
        <NumberInput
          aria-label={discountMode === 'percentage' ? 'Discount percent' : 'Discount amount'}
          aria-invalid={discountError ? true : undefined}
          value={discountInput}
          onChange={(e) => onDiscountInput(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>
      {discountCap !== null && discountCap !== undefined && !isPurchase && (
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '4px' }}>You can give up to {discountCap}%.</div>
      )}
      {discountError && (
        <div role="alert" style={{ ...theme.type.footnote, color: c.redText, marginTop: '4px' }}>
          {discountError}
        </div>
      )}

      <div style={styles.divider} />
      <Line label="Items" value={itemCount} />
      <Line label="Subtotal" value={formatCurrency(subtotal)} />
      {discountAmount > 0 && <Line label="Discount" value={`− ${formatCurrency(discountAmount)}`} />}
      {freeUnits > 0 && <Line label="Free units" value={freeUnits} color={c.greenText} />}
      <div style={{ ...styles.label, marginTop: theme.spacing.sm }}>Total</div>
      <div style={styles.total}>{formatCurrency(total)}</div>

      <div style={styles.divider} />
      <div style={styles.label}>{isPurchase ? 'Amount you paid now' : 'Amount received'}</div>
      <NumberInput
        aria-label={isPurchase ? 'Amount paid' : 'Amount received'}
        value={paidInput}
        placeholder={String(total)}
        onChange={(e) => onPaidInput(e.target.value)}
        onFocus={(e) => e.target.select()}
        style={{ height: '44px', fontSize: theme.type.headline.fontSize }}
      />
      <div aria-live="polite" style={{ ...theme.type.subhead, ...theme.font.numeric, marginTop: '6px', minHeight: '20px' }}>
        {paidInput === '' ? (
          <span style={{ color: c.labelSecondary }}>{isPurchase ? 'Paid in full.' : 'Exact amount — no change to give back.'}</span>
        ) : changeDue > 0 && !isPurchase ? (
          <span style={{ color: c.greenText, fontWeight: theme.font.weightSemibold }}>Change to give back: {formatCurrency(changeDue)}</span>
        ) : balanceDue > 0 ? (
          <span style={{ color: c.orangeText, fontWeight: theme.font.weightSemibold }}>
            {isPurchase ? 'Still owed to supplier' : 'Balance due'}: {formatCurrency(balanceDue)}
          </span>
        ) : (
          <span style={{ color: c.labelSecondary }}>Paid in full.</span>
        )}
      </div>
      <SegmentedControl
        label="Payment method"
        value={method}
        onChange={onMethod}
        fullWidth
        style={{ marginTop: theme.spacing.sm }}
        options={METHODS}
      />
      {paid <= 0 && total > 0 && (
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '4px' }}>
          Nothing paid now — the whole bill goes on {isPurchase ? "the supplier's" : "the customer's"} account.
        </div>
      )}

      {!isPurchase && (
        <>
          <div style={styles.divider} />
          <div style={styles.label}>Print</div>
          <SegmentedControl label="Receipt format" value={printFormat} onChange={onPrintFormat} fullWidth options={FORMATS} />
          {showDuesOption && (
            <Checkbox
              label="Show outstanding balance on the receipt"
              checked={showDues}
              onChange={(e) => onShowDues(e.target.checked)}
              style={{ marginTop: theme.spacing.sm }}
            />
          )}
        </>
      )}

      {error && <Banner style={{ marginTop: theme.spacing.smd }}>{error}</Banner>}

      <div style={{ marginTop: 'auto', paddingTop: theme.spacing.md }}>
        <Button size="lg" fullWidth loading={saving} disabled={!canSave} onClick={onSave}>
          {isPurchase ? 'Save purchase' : 'Complete sale'}
        </Button>
        <div style={{ ...theme.type.caption, color: c.labelTertiary, textAlign: 'center', marginTop: '6px' }}>Ctrl + Enter to save</div>
      </div>
    </Card>
  );
}

// Positive = they owe the shop (customer) or the shop owes them (supplier): orange.
// Negative = they are in credit: green.
function BalanceBox({ label, value, isPurchase, emphasis }) {
  const color = value > 0 ? c.orangeText : value < 0 ? c.greenText : c.label;
  const words = value > 0 ? (isPurchase ? 'You owe' : 'Owes shop') : value < 0 ? (isPurchase ? 'Paid in advance' : 'In credit') : 'Settled';
  return (
    <div style={{ ...styles.balanceBox, backgroundColor: emphasis ? c.accentTint : c.surfaceAlt }}>
      <div style={{ ...styles.label, marginBottom: '2px' }}>{label}</div>
      <div style={{ ...theme.type.title2, ...theme.font.numeric, fontWeight: theme.font.weightBold, color }}>{formatCurrency(Math.abs(value))}</div>
      <div style={{ ...theme.type.caption, color }}>{words}</div>
    </div>
  );
}

function Line({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm, padding: '3px 0', ...theme.type.body }}>
      <span style={{ color: color || c.labelSecondary }}>{label}</span>
      <span style={{ ...theme.font.numeric, color: color || c.label, fontWeight: theme.font.weightMedium }}>{value}</span>
    </div>
  );
}

export function PartyTypeBadge({ type }) {
  return type === 'wholesale' ? <Badge tone="purple">Wholesale</Badge> : <Badge tone="blue">Retail</Badge>;
}

const styles = {
  card: { width: '340px', flexShrink: 0, boxSizing: 'border-box', overflowY: 'auto', alignSelf: 'stretch', display: 'flex', flexDirection: 'column' },
  label: { ...theme.type.footnote, color: c.labelSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' },
  partyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  balances: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.smd },
  balanceBox: { flex: 1, minWidth: 0, padding: theme.spacing.sm, borderRadius: theme.radius.md, border: `1px solid ${c.separator}` },
  divider: { height: '1px', backgroundColor: c.separator, margin: `${theme.spacing.smd} 0` },
  total: { ...theme.font.numeric, fontSize: '34px', lineHeight: '42px', fontWeight: theme.font.weightBold, letterSpacing: '-0.02em', color: c.label },
};
