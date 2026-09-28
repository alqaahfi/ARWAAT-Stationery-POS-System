import React from 'react';
import theme from '../config/theme';
import glossary from '../config/glossary';
import { formatCurrency } from '../utils/format';

const c = theme.colors;

// Balance in plain words. Customer: positive = they owe you. Supplier:
// positive = you owe them. Negative = paid in advance. The amount always
// comes from the backend — never work it out here.
export function balanceWords(amount, party = 'customer') {
  const value = Number(amount);
  if (Math.abs(value) < 0.005) return { text: glossary.noBalance, color: c.labelSecondary, label: 'Balance' };
  const formatted = formatCurrency(Math.abs(value));
  if (value < 0) return { text: glossary.paidAdvance(formatted), color: c.greenText, label: 'Paid in advance', figure: formatted };
  return party === 'supplier'
    ? { text: glossary.supplierOwed(formatted), color: c.orangeText, label: 'You owe', figure: formatted }
    : { text: glossary.customerOwes(formatted), color: c.orangeText, label: 'Owes you', figure: formatted };
}

// size "md": inline phrase. size "xl": small label above a big number.
export default function BalanceChip({ amount, party = 'customer', size = 'md', style }) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null;
  const w = balanceWords(amount, party);

  if (size === 'xl') {
    return (
      <div style={{ textAlign: 'right', ...style }}>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{w.label}</div>
        <div style={{ ...theme.type.largeTitle, ...theme.font.numeric, color: w.figure ? w.color : c.labelSecondary, whiteSpace: 'nowrap' }}>
          {w.figure || glossary.noBalance}
        </div>
      </div>
    );
  }

  return (
    <span style={{ ...theme.type.subhead, ...theme.font.numeric, fontWeight: theme.font.weightMedium, color: w.color, whiteSpace: 'nowrap', ...style }}>
      {w.text}
    </span>
  );
}
