import React from 'react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';
import { Checkbox, Spinner, TextInput } from '../../../components/ui';
import { InlineMessage, NUMERIC_INPUT, PanelTitle, c, keepFocus } from './common';

// Rule 9: cash only — the payment step is just "Amount received" and "Change".
// Digits and one dot only (a scanner or a stray key can't put letters in the cash box).
function cleanAmount(value) {
  let v = String(value ?? '').replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  return v;
}

export default function PaymentPanel({
  inputRef,
  amount,
  onAmountChange,
  total,
  changeDue,
  balanceDue,
  showDuesOption,
  showDues,
  onShowDuesChange,
  blockedNoCustomer,
  error,
  completing,
}) {
  return (
    <>
      <PanelTitle title="Amount received" hint="Cash only. Press Enter if they paid the exact amount." />
      <div style={styles.row}>
        <label style={{ ...theme.type.subhead, color: c.labelSecondary }}>
          Amount received
          <TextInput
            ref={inputRef}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => onAmountChange(cleanAmount(e.target.value))}
            placeholder={String(total)}
            aria-label="Amount received"
            style={{ ...NUMERIC_INPUT, width: '220px', display: 'block', marginTop: '4px' }}
          />
        </label>
      </div>

      <div aria-live="polite" style={{ ...theme.type.headline, ...theme.font.numeric, marginTop: theme.spacing.smd, minHeight: '20px' }}>
        {amount === '' ? (
          <span style={{ color: c.labelSecondary, fontWeight: theme.font.weightMedium }}>Exact amount — no change to give back.</span>
        ) : changeDue > 0 ? (
          <span style={{ color: c.greenText }}>Change: {formatCurrency(changeDue)}</span>
        ) : balanceDue > 0 ? (
          <span style={{ color: c.orangeText }}>Balance due: {formatCurrency(balanceDue)}</span>
        ) : (
          <span style={{ color: c.labelSecondary, fontWeight: theme.font.weightMedium }}>Paid in full.</span>
        )}
      </div>

      {showDuesOption && (
        <div onMouseDown={keepFocus}>
          <Checkbox
            label="Show outstanding balance on the receipt"
            checked={showDues}
            onChange={(e) => onShowDuesChange(e.target.checked)}
            style={{ marginTop: theme.spacing.smd }}
          />
        </div>
      )}

      {(blockedNoCustomer || error) && (
        <InlineMessage tone="warning">
          {error || 'Walk-in sales must be paid in full — select a customer to allow partial payment.'}
          {blockedNoCustomer && (
            <>
              {' '}Press <strong>Esc</strong> to choose a customer.
            </>
          )}
        </InlineMessage>
      )}
      {completing && (
        <div aria-live="polite" style={styles.completing}>
          <Spinner size={16} /> Finishing the sale…
        </div>
      )}
    </>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, flexWrap: 'wrap' },
  completing: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, ...theme.type.subhead, color: c.labelSecondary, marginTop: theme.spacing.sm },
};
