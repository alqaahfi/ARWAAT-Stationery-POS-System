import React from 'react';
import theme from '../../../config/theme';
import { formatCount, formatCurrency } from '../../../utils/format';
import { TextInput } from '../../../components/ui';
import { InlineMessage, Money, NUMERIC_INPUT, PanelTitle, c, packSizeName, typeName } from './common';

export default function QtyPanel({ inputRef, focInputRef, item, value, onChange, focValue, onFocChange, lineTotal, stockError }) {
  const pack = packSizeName(item);
  const inStock = item.stockQty / item.conversionFactor;
  const summary = [item.productName, typeName(item.variantName), pack].filter(Boolean).join(' · ');

  return (
    <>
      <PanelTitle title="How many?" hint="Type the quantity and press Enter. Press Esc to pick a different item." />
      <div style={styles.summary}>
        <span style={{ ...theme.type.headline, color: c.label }}>{summary}</span>
        <Money value={`${formatCurrency(item.unitPrice)} each`} style={{ ...theme.type.body, color: c.labelSecondary }} />
      </div>

      <div style={styles.row}>
        <label style={{ ...theme.type.subhead, color: c.labelSecondary }}>
          Quantity ({pack})
          <TextInput
            ref={inputRef}
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={stockError ? true : undefined}
            style={{ ...NUMERIC_INPUT, width: '160px', display: 'block', marginTop: '4px' }}
          />
        </label>
        <label style={{ ...theme.type.subhead, color: c.labelSecondary }}>
          Free (FOC) <span style={{ ...theme.type.caption, color: c.labelTertiary }}>Tab</span>
          <TextInput
            ref={focInputRef}
            type="number"
            min="0"
            value={focValue}
            onChange={(e) => onFocChange(e.target.value)}
            aria-label="Free of cost quantity"
            style={{ ...NUMERIC_INPUT, width: '120px', display: 'block', marginTop: '4px' }}
          />
        </label>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }} aria-live="polite">
          <div style={{ ...theme.type.subhead, color: c.labelSecondary }}>Line total</div>
          <Money value={formatCurrency(lineTotal)} style={{ ...theme.type.title1, color: c.label }} />
        </div>
      </div>

      <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, marginTop: theme.spacing.sm }}>
        {formatCount(inStock)} {pack} in stock
      </div>
      <InlineMessage tone="error">{stockError}</InlineMessage>
    </>
  );
}

const styles = {
  summary: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    backgroundColor: c.surfaceAlt,
    border: `1px solid ${c.separator}`,
  },
  row: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.md, marginTop: theme.spacing.md },
};
