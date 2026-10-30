import React, { useEffect, useRef } from 'react';
import theme from '../../config/theme';
import { formatCount } from '../../utils/format';
import { TextInput } from '../ui';
import { wholeNumber } from '../../utils/quantity';

const c = theme.colors;

// One compact panel to enter the quantity of every Type of a product at once.
// Blank = 0 (that Type is simply not added). Shared by the keyboard POS and the
// quick Sale / Purchase forms.
//
//   types     [{ variantId, variantName, stockQty }]  (stockQty in base units)
//   values    { [variantId]: '3' }
//   unitLabel pack size name shown next to the quantities (e.g. "Piece")
//   stockOf   optional (type) => units on the shelf, to show "N in stock" and flag overruns
//   hint      optional line under the title
//
// Keys inside the panel: Enter confirms, Esc cancels, Up/Down move between Types.
export default function MultiTypeQtyPanel({ productName, unitLabel, types, values, onChange, onConfirm, onCancel, stockOf, hint, error }) {
  const firstRef = useRef(null);
  const total = types.reduce((sum, t) => sum + (Number(values[t.variantId]) || 0), 0);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const inputs = [...e.currentTarget.querySelectorAll('input[data-type-qty]')];
      const next = inputs[inputs.indexOf(document.activeElement) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        e.preventDefault();
        next.focus();
        next.select();
      }
    }
  }

  return (
    <div onKeyDown={onKeyDown}>
      <div style={styles.head}>
        <span style={{ ...theme.type.headline, color: c.label }}>{productName}</span>
        {unitLabel && <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>{unitLabel}</span>}
      </div>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, margin: `${theme.spacing.xs} 0 ${theme.spacing.sm}` }}>
        {hint || 'Type a quantity for each Type you want. Leave the others empty.'}
      </div>

      <div style={styles.grid}>
        {types.map((t, i) => {
          const qty = Number(values[t.variantId]) || 0;
          const over = stockOf && qty > stockOf(t);
          return (
            <label key={t.variantId} style={styles.cell}>
              <span style={{ ...theme.type.subhead, color: c.label, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.variantName}
              </span>
              <TextInput
                ref={i === 0 ? firstRef : undefined}
                data-type-qty
                type="text"
                inputMode="numeric"
                value={values[t.variantId] ?? ''}
                onChange={(e) => onChange(t.variantId, wholeNumber(e.target.value))}
                onFocus={(e) => e.target.select()}
                aria-label={`Quantity of ${t.variantName}`}
                aria-invalid={over ? true : undefined}
                placeholder="0"
                style={{ ...theme.font.numeric, textAlign: 'right', height: '34px', width: '84px' }}
              />
              {stockOf && (
                <span style={{ ...theme.type.caption, ...theme.font.numeric, color: over ? c.redText : c.labelTertiary, whiteSpace: 'nowrap' }}>
                  {over ? `Only ${formatCount(stockOf(t))}` : `${formatCount(stockOf(t))} in stock`}
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div style={styles.total}>
        <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>Total quantity</span>
        <span style={{ ...theme.type.headline, ...theme.font.numeric, color: c.label }}>{formatCount(total)}</span>
      </div>
      {error && (
        <div role="alert" style={{ ...theme.type.footnote, color: c.redText, marginTop: theme.spacing.xs }}>
          {error}
        </div>
      )}
    </div>
  );
}

const styles = {
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.md },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: `${theme.spacing.xs} ${theme.spacing.md}`,
    maxHeight: '320px',
    overflowY: 'auto',
  },
  cell: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: '4px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: c.surfaceAlt,
    border: `1px solid ${c.separator}`,
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${c.separator}`,
  },
};

// Entries to add: only Types with a quantity above zero (blank counts as 0).
export function entriesFromValues(types, values) {
  return types
    .map((t) => ({ type: t, quantity: Number(values[t.variantId]) || 0 }))
    .filter((e) => e.quantity > 0);
}
