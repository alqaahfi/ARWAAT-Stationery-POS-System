import React from 'react';
import theme from '../../../config/theme';
import { Kbd } from '../../../components/ui';
import { c } from './common';

// Mirrors the branches of Sale.jsx's keydown handler — update both together.
export function getKeyHints(stage, ctx) {
  const { cancelOpen, draftAvailable, resultsOpen, hasQuery, cartCount, editingLine, partialBlocked, amountTyped, printFailed } = ctx;
  if (cancelOpen) return [[['Enter'], 'Cancel sale'], [['Esc'], 'Keep working']];

  switch (stage) {
    case 'idle':
      return draftAvailable ? [[['R'], 'Resume'], [['N'], 'Start new']] : [[['S'], 'New sale']];
    case 'customer':
      return [
        [['↑', '↓'], 'Choose'],
        [['Enter'], 'Select'],
        [['Tab'], 'Walk-in / skip'],
        [['Esc'], cartCount > 0 ? 'Cancel sale' : 'Cancel'],
      ];
    case 'item-search':
      if (resultsOpen) {
        return [
          [['↑', '↓'], 'Product'],
          [['Tab'], 'Type / Pack size'],
          [['←', '→'], 'Change'],
          [['Enter'], 'Add'],
          [['Esc'], 'Cancel sale'],
        ];
      }
      return [
        ...(hasQuery ? [[['Enter'], 'Add']] : []),
        ...(cartCount > 0 ? [[['↑'], 'Edit items']] : []),
        [['Tab'], 'Next: Discount'],
        [['Esc'], 'Cancel sale'],
      ];
    case 'qty':
      return [[['Enter'], 'Add to sale'], [['Esc'], 'Back']];
    case 'cart-edit':
      if (editingLine) return [[['Enter'], 'Save quantity'], [['Esc'], 'Cancel change']];
      return [
        [['↑', '↓'], 'Choose'],
        [['Enter'], 'Change quantity'],
        [['Delete'], 'Remove'],
        [['Ctrl', 'Z'], 'Undo'],
        [['Esc'], 'Back to items'],
      ];
    case 'discount':
      return [[['Enter', '/', 'Tab'], 'Next'], [['Esc'], 'Cancel sale']];
    case 'format':
      return [[['←', '→', '/', '1', '2'], 'Choose'], [['Enter', '/', 'Tab'], 'Next'], [['Esc'], 'Cancel sale']];
    case 'payment':
      if (partialBlocked) return [[['C', 'B', 'O'], 'Method'], [['Esc'], 'Choose a customer']];
      return [[['Enter'], amountTyped ? 'Finish sale' : 'Exact payment'], [['C', 'B', 'O'], 'Method'], [['Esc'], 'Cancel sale']];
    case 'confirm':
      return [[['Enter'], 'New sale'], [['Esc'], 'Close'], ...(printFailed ? [[['R'], 'Retry print']] : [])];
    default:
      return [];
  }
}

export default function KeyHints({ hints }) {
  return (
    <div style={styles.bar} aria-label="Keyboard shortcuts">
      {hints.map(([keys, label], i) => (
        <span key={i} style={styles.hint}>
          <span style={styles.keys}>
            {keys.map((k, j) =>
              k === '/' ? (
                <span key={j} style={styles.or}>
                  or
                </span>
              ) : (
                <Kbd key={j}>{k}</Kbd>
              )
            )}
          </span>
          {label}
        </span>
      ))}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.mdl,
    height: '44px',
    flexShrink: 0,
    // The right-most strip stays empty for the Dev Panel trigger.
    padding: '0 56px 0 16px',
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    border: `1px solid ${c.separator}`,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    ...theme.type.subhead,
    color: c.labelSecondary,
  },
  hint: { display: 'inline-flex', alignItems: 'center', gap: '6px' },
  keys: { display: 'inline-flex', alignItems: 'center', gap: '2px' },
  or: { ...theme.type.footnote, color: c.labelTertiary, margin: '0 2px' },
};
