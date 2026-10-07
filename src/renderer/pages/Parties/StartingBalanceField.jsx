import React, { useState } from 'react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { NumberInput, SegmentedControl } from '../../components/ui';
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

const KIND_OPTIONS = {
  customer: [
    { value: 'owed', label: 'Owed (they owe you)' },
    { value: 'advance', label: 'Advance (they paid you)' },
  ],
  supplier: [
    { value: 'owed', label: 'Owed (you owe them)' },
    { value: 'advance', label: 'Advance (you paid them)' },
  ],
};
const HINTS = {
  customer: {
    owed: 'How much does this customer already owe you? Leave 0 for a new customer.',
    advance: 'How much has this customer already paid you in advance? It will be taken off their next bills.',
  },
  supplier: {
    owed: 'How much do you already owe this supplier? Leave 0 if nothing.',
    advance: 'How much have you already paid this supplier in advance? It will be taken off their next bills.',
  },
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
  return <EditableBalance party={party} value={value} onChange={onChange} id={id} />;
}

// The amount is typed as a plain positive number; the Owed / Advance choice
// decides the sign that is stored (an advance is a negative balance).
function EditableBalance({ party, value, onChange, id }) {
  const [kind, setKind] = useState(String(value ?? '').trim().startsWith('-') || Number(value) < 0 ? 'advance' : 'owed');
  const amount = String(value ?? '').replace(/^-/, '');
  const emit = (k, amt) => onChange(k === 'advance' && amt !== '' && Number(amt) !== 0 ? `-${amt}` : amt);
  return (
    <FormRow label={glossary.startingBalance} hint={HINTS[party][kind]}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        <SegmentedControl
          size="sm"
          label="Is this amount owed or an advance?"
          value={kind}
          options={KIND_OPTIONS[party]}
          onChange={(k) => {
            setKind(k);
            emit(k, amount);
          }}
        />
        <NumberInput
          id={id}
          value={amount}
          placeholder="0"
          onFocus={(e) => e.target.select()}
          onChange={(e) => emit(kind, cleanAmount(e.target.value).replace(/^-/, ''))}
        />
      </div>
    </FormRow>
  );
}
