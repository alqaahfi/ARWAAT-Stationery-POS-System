import React from 'react';
import theme from '../../../config/theme';
import { Banner, ChipGroup, Field, NumberInput, Textarea } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { METHOD_OPTIONS } from '../../Ledgers/parts/ledgerUtils';

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
          <span>Preview · After this payment:</span>
          <BalanceChip amount={Number(balance) - value} party={party} />
        </div>
      )}

      <div style={{ marginBottom: theme.spacing.md }}>
        <div aria-hidden="true" style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>
          Method
        </div>
        <ChipGroup options={METHOD_OPTIONS} value={method} onChange={onMethodChange} aria-label="Method" />
      </div>

      <Field label="Note (optional)" style={{ marginBottom: 0 }}>
        <Textarea value={note} onChange={(e) => onNoteChange(e.target.value)} placeholder="e.g. Part payment for last month" />
      </Field>

      <Banner>{error}</Banner>
    </div>
  );
}
