import React from 'react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { NumberInput } from '../../components/ui';
import { FormRow } from './PartyParts';
import { formatCurrency } from '../../utils/format';

const c = theme.colors;

// Digits, one dot, and a leading minus (a negative start = paid in advance).
function cleanAmount(raw) {
  const minus = raw.trim().startsWith('-') ? '-' : '';
  let v = raw.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  return minus + v;
}

const HINTS = {
  customer: 'How much does this customer already owe you? Leave 0 for a new customer.',
  supplier: 'How much do you already owe this supplier? Leave 0 if nothing.',
};
const LATER = {
  customer: `To change a balance later, use ${glossary.receivePayment} or add a Balance Correction in ${glossary.accounts}.`,
  supplier: `To change a balance later, use ${glossary.paySupplier} or add a Balance Correction in ${glossary.accounts}.`,
};

// Editable only when creating; afterwards the balance moves through payments
// and corrections, so here it is just shown.
export function StartingBalanceField({ party = 'customer', isEdit, value, onChange, id }) {
  if (isEdit) {
    return (
      <FormRow label={glossary.startingBalance} hint={LATER[party]}>
        <div style={{ ...theme.type.body, ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightSemibold }}>{formatCurrency(value)}</div>
      </FormRow>
    );
  }
  return (
    <FormRow label={glossary.startingBalance} hint={HINTS[party]}>
      <NumberInput id={id} value={value ?? ''} placeholder="0" onFocus={(e) => e.target.select()} onChange={(e) => onChange(cleanAmount(e.target.value))} />
    </FormRow>
  );
}
