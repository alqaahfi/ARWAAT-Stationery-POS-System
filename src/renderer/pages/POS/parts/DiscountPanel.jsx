import React from 'react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';
import { SegmentedControl, TextInput } from '../../../components/ui';
import { InlineMessage, Money, NUMERIC_INPUT, PanelTitle, c, keepFocus } from './common';

const MODES = [
  { value: 'percentage', label: 'Percent (%)' },
  { value: 'fixed', label: 'Amount' },
];

export default function DiscountPanel({ inputRef, mode, onModeChange, value, onChange, cap, discountAmount, error }) {
  const hasCap = cap !== null && cap !== undefined;
  return (
    <>
      <PanelTitle
        title="Any discount?"
        hint={`${hasCap ? `You can give up to ${cap}%. ` : ''}Leave it at 0 for no discount, then press Enter.`}
      />
      <div style={styles.row}>
        <div onMouseDown={keepFocus}>
          <SegmentedControl label="Discount type" options={MODES} value={mode} onChange={onModeChange} style={{ height: '48px' }} />
        </div>
        <TextInput
          ref={inputRef}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={mode === 'percentage' ? 'Discount percent' : 'Discount amount'}
          aria-invalid={error ? true : undefined}
          style={{ ...NUMERIC_INPUT, width: '180px' }}
        />
        <div style={{ marginLeft: 'auto', textAlign: 'right' }} aria-live="polite">
          <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>Discount</div>
          <Money value={discountAmount > 0 ? `− ${formatCurrency(discountAmount)}` : formatCurrency(0)} style={{ ...theme.type.title2, color: c.label }} />
        </div>
      </div>
      <InlineMessage tone="error">{error}</InlineMessage>
    </>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, flexWrap: 'wrap' },
};
