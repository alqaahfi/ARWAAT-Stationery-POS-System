import React from 'react';
import { Banknote, Building2, Ellipsis } from 'lucide-react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';
import { Checkbox, Kbd, SegmentedControl, Spinner, TextInput } from '../../../components/ui';
import { InlineMessage, NUMERIC_INPUT, PanelTitle, c, keepFocus } from './common';

const METHODS = [
  { value: 'cash', label: 'Cash', key: 'C', icon: Banknote },
  { value: 'bank', label: 'Bank', key: 'B', icon: Building2 },
  { value: 'other', label: 'Other', key: 'O', icon: Ellipsis },
];

export default function PaymentPanel({
  inputRef,
  amount,
  onAmountChange,
  total,
  changeDue,
  balanceDue,
  method,
  onMethodChange,
  showDuesOption,
  showDues,
  onShowDuesChange,
  blockedNoCustomer,
  error,
  completing,
}) {
  return (
    <>
      <PanelTitle title="How much did the customer pay?" hint="Press Enter if they paid the exact amount." />
      <div style={styles.row}>
        <TextInput
          ref={inputRef}
          type="number"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder={String(total)}
          aria-label="Amount received"
          style={{ ...NUMERIC_INPUT, width: '220px' }}
        />
        <div onMouseDown={keepFocus}>
          <SegmentedControl
            label="Payment method"
            value={method}
            onChange={onMethodChange}
            style={{ height: '48px' }}
            options={METHODS.map((m) => ({
              value: m.value,
              icon: m.icon,
              label: (
                <>
                  {m.label} <Kbd>{m.key}</Kbd>
                </>
              ),
            }))}
          />
        </div>
      </div>

      <div aria-live="polite" style={{ ...theme.type.headline, ...theme.font.numeric, marginTop: theme.spacing.smd, minHeight: '20px' }}>
        {amount === '' ? (
          <span style={{ color: c.labelSecondary, fontWeight: theme.font.weightMedium }}>Exact amount — no change to give back.</span>
        ) : changeDue > 0 ? (
          <span style={{ color: c.greenText }}>Change to give back: {formatCurrency(changeDue)}</span>
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
          {error || 'Select a customer to allow partial payment.'}
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
