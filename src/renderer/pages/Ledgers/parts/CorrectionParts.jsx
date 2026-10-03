import React, { useId } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import theme from '../../../config/theme';
import { Avatar, Badge, Banner, Button, EmptyState, Field, Modal, NumberInput, SegmentedControl, Textarea } from '../../../components/ui';
import BalanceChip from '../../../components/BalanceChip';
import { formatCurrency, formatDateOnly } from '../../../utils/format';
import PartyPicker from './PartyPicker';
import { DateCell, InlineError, PartyCell } from './LedgerParts';
import { formatTime } from './ledgerUtils';

const c = theme.colors;

const PARTY_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'supplier', label: 'Supplier' },
];

export function directionOptions(partyType) {
  return partyType === 'supplier'
    ? [
        { value: 'more', label: 'You owe them more' },
        { value: 'less', label: 'You owe them less' },
      ]
    : [
        { value: 'more', label: 'They owe more' },
        { value: 'less', label: 'They owe less' },
      ];
}

function ChangeCell({ amount, partyType }) {
  const value = Number(amount) || 0;
  const more = value > 0;
  const who = partyType === 'supplier' ? 'you owe' : 'owes';
  return (
    <span style={{ whiteSpace: 'nowrap', color: more ? c.orangeText : c.greenText }}>
      <span style={{ fontWeight: theme.font.weightSemibold }}>{`${more ? '+' : '−'}${formatCurrency(Math.abs(value))}`}</span>
      <span style={{ ...theme.type.footnote, marginLeft: '6px' }}>{`${who} ${more ? 'more' : 'less'}`}</span>
    </span>
  );
}

export function correctionColumns(hasAddedBy) {
  const cols = [
    { key: 'date', label: 'Date', width: '120px', render: (r) => <DateCell date={formatDateOnly(r.created_at)} time={formatTime(r.created_at)} /> },
    {
      key: 'party',
      label: 'Party',
      render: (r) => (
        <PartyCell
          name={r.party_name}
          badge={
            <Badge size="sm" tone={r.party_type === 'supplier' ? 'orange' : 'blue'}>
              {r.party_type === 'supplier' ? 'Supplier' : 'Customer'}
            </Badge>
          }
        />
      ),
    },
    { key: 'change', label: 'Change', numeric: true, render: (r) => <ChangeCell amount={r.amount} partyType={r.party_type} /> },
    { key: 'reason', label: 'Reason', render: (r) => <span style={{ color: c.label }}>{r.reason}</span> },
  ];
  if (hasAddedBy) cols.push({ key: 'by', label: 'Added by', render: (r) => r.created_by_name || '—' });
  return cols;
}

export function CorrectionsEmpty() {
  return (
    <EmptyState
      icon={SlidersHorizontal}
      title="No corrections yet"
      message="Use a correction to fix a wrong balance or write off a debt someone won't pay."
    />
  );
}

function StepTitle({ n, children }) {
  return (
    <div style={{ ...theme.type.headline, color: c.label, margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` }}>
      <span style={{ color: c.labelSecondary, marginRight: '6px' }}>{n}.</span>
      {children}
    </div>
  );
}

export function CorrectionModal({
  open,
  partyType,
  onPartyType,
  party,
  onPick,
  onClearParty,
  direction,
  onDirection,
  amount,
  onAmount,
  reason,
  onReason,
  preview,
  errors,
  saving,
  onSubmit,
  onClose,
}) {
  const formId = useId();
  const noun = partyType === 'supplier' ? 'supplier' : 'customer';

  return (
    <Modal
      open={open}
      onClose={saving ? undefined : onClose}
      dismissible={!saving}
      title="Add a balance correction"
      width={500}
      footer={
        <>
          <Button variant="plain" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Add correction
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate>
        <StepTitle n={1}>Who?</StepTitle>
        <SegmentedControl options={PARTY_OPTIONS} value={partyType} onChange={onPartyType} label="Customer or supplier" fullWidth />
        <div style={{ marginTop: theme.spacing.sm }}>
          {party ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.smd,
                padding: '8px 10px',
                borderRadius: theme.radius.md,
                border: `1px solid ${c.separator}`,
                backgroundColor: c.surfaceAlt,
              }}
            >
              <Avatar name={party.name} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold }}>{party.name}</div>
                <BalanceChip amount={party.balance_owed} party={partyType} />
              </div>
              <Button variant="plain" size="sm" onClick={onClearParty}>
                Change
              </Button>
            </div>
          ) : (
            <PartyPicker key={partyType} party={partyType} onPick={onPick} compact autoFocus={false} />
          )}
          <InlineError>{errors.party}</InlineError>
        </div>

        <StepTitle n={2}>What happened?</StepTitle>
        <SegmentedControl options={directionOptions(partyType)} value={direction} onChange={onDirection} label="What happened" fullWidth />

        <StepTitle n={3}>How much?</StepTitle>
        <Field style={{ marginBottom: 0 }}>
          <NumberInput
            aria-label="Amount"
            aria-invalid={!!errors.amount}
            value={amount}
            onChange={(e) => onAmount(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            style={{ height: '44px', fontSize: '20px', fontWeight: theme.font.weightSemibold }}
          />
        </Field>
        <InlineError>{errors.amount}</InlineError>
        {preview && (
          <div aria-live="polite" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginTop: theme.spacing.sm, ...theme.type.footnote, color: c.labelSecondary }}>
            <span>Balance will change from</span>
            <BalanceChip amount={preview.from} party={partyType} />
            <span>to</span>
            <BalanceChip amount={preview.to} party={partyType} />
          </div>
        )}

        <StepTitle n={4}>Why?</StepTitle>
        <Field hint={errors.reason ? undefined : `Kept with the correction so you remember why this ${noun}'s balance changed.`} style={{ marginBottom: 0 }}>
          <Textarea
            aria-label="Reason"
            aria-invalid={!!errors.reason}
            value={reason}
            onChange={(e) => onReason(e.target.value)}
            placeholder="e.g. Wrote off an old debt they can't pay"
          />
        </Field>
        <InlineError>{errors.reason}</InlineError>

        <Banner>{errors.form}</Banner>
      </form>
    </Modal>
  );
}
