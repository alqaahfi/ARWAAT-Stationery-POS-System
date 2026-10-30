import React from 'react';
import theme from '../../../config/theme';
import { Banner, Field, NumberInput, Textarea } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';

const c = theme.colors;

// Amount · Method · Note. Presentational only — the page owns the values,
// validation and saving. balance + party (optional) add a live preview line.
export default function PaymentFormFields({
  amount,
  onAmountChange,
  method,
  onMethodChange,
  note,
  onNoteChange,
  error,
  autoFocus = true,
  balance,
  party = 'customer',
  previewSign = 1, // 1 = money paid (balance goes down), -1 = amount added to the account
  previewLabel = 'Preview · After this payment:',
  hideMethod = false,
}) {
  const value = Number(amount);
  const hasBalance = balance !== undefined && balance !== null && !Number.isNaN(Number(balance));
  const showPreview = hasBalance && value > 0;

  return (
    <div>
      <Field label="Amount">
        <NumberInput
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          onWheel={(e) => e.currentTarget.blur()}
          autoFocus={autoFocus}
          placeholder="0"
          style={{ height: '52px', fontSize: '24px', fontWeight: theme.font.weightSemibold }}
        />
      </Field>

      {showPreview && (
        <div
          aria-live="polite"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', margin: `-${theme.spacing.sm} 0 ${theme.spacing.md}`, ...theme.type.footnote, color: c.labelSecondary }}
        >
          <span>{previewLabel}</span>
          <BalanceChip amount={Number(balance) - previewSign * value} party={party} />
        </div>
      )}

      {/* Rule 9: cash only — every new payment is recorded as cash, so there is no method to choose. */}
      {!hideMethod && (
        <div style={{ marginBottom: theme.spacing.md, ...theme.type.footnote, color: c.labelSecondary }}>Paid in cash.</div>
      )}

      <Field label="Note (optional)" style={{ marginBottom: 0 }}>
        <Textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="e.g. Part payment for last month" />
      </Field>

      <Banner>{error}</Banner>
    </div>
  );
}
