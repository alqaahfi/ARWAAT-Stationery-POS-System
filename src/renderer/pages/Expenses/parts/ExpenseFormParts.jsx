import React from 'react';
import { CircleSlash, Repeat } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, ChipGroup, Field, Icon, SegmentedControl, TextInput, Textarea } from '../../../components/ui';
import { NumInput, SectionCard, grid } from '../../Products/form/fields';
import { REPEAT_CHOICES, repeatLabel } from './expenseUi';

const c = theme.colors;

export const pageWrap = { minHeight: '100%', display: 'flex', flexDirection: 'column' };
export const pageColumn = {
  width: '100%',
  maxWidth: '640px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing.md,
  paddingBottom: theme.spacing.xxl,
};

export function BasicsCard({ amount, onAmount, amountError, expenseDate, onDate, payee, onPayee, description, onDescription, descriptionError, isEdit, repeating }) {
  return (
    <SectionCard title="Basics">
      <Field label="Amount" required error={amountError}>
        <NumInput
          id="expense-amount"
          value={amount}
          onChange={onAmount}
          autoFocus={!isEdit}
          placeholder="0"
          style={{ height: '52px', fontSize: '24px', fontWeight: theme.font.weightSemibold }}
        />
      </Field>
      <div style={grid(200)}>
        <Field label="Date" hint={repeating ? 'The first one is added on this date.' : undefined}>
          <TextInput type="date" value={expenseDate} onChange={(e) => onDate(e.target.value)} />
        </Field>
        <Field label={`${glossary.paidTo} (optional)`}>
          <TextInput value={payee} onChange={(e) => onPayee(e.target.value)} placeholder="e.g. K-Electric" autoComplete="off" />
        </Field>
      </div>
      <Field label="Description" required error={descriptionError} style={{ marginBottom: 0 }}>
        <Textarea
          id="expense-description"
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="e.g. Electricity bill for August"
          rows={2}
          style={{ minHeight: '56px' }}
        />
      </Field>
    </SectionCard>
  );
}

const MODE_OPTIONS = [
  { value: 'once', label: glossary.justOnce },
  { value: 'repeats', label: glossary.repeats },
];

// Create mode: choose once / repeating and how often.
export function RepeatsCard({ recurrence, onRecurrence }) {
  const repeating = recurrence !== 'one_time';
  return (
    <SectionCard title={glossary.repeats}>
      <SegmentedControl
        label="Does this expense repeat?"
        options={MODE_OPTIONS}
        value={repeating ? 'repeats' : 'once'}
        onChange={(v) => onRecurrence(v === 'repeats' ? 'monthly' : 'one_time')}
      />
      {repeating && (
        <div style={{ marginTop: theme.spacing.md }}>
          <ChipGroup options={REPEAT_CHOICES} value={recurrence} onChange={onRecurrence} aria-label="How often" />
          <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: `${theme.spacing.smd} 0 0` }}>
            A new expense is added automatically each {glossary.repeatPeriod[recurrence]}. If the app is closed for a while, the missed ones
            are added when it next opens.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// Edit mode: the repeat type is fixed once created.
export function LockedRepeatsCard({ recurrence, canStop, stopped, stopping, onStop }) {
  const label = repeatLabel(recurrence);
  return (
    <SectionCard title={glossary.repeats}>
      {!label ? (
        <div style={{ ...theme.type.body, color: c.label }}>This expense happens just once.</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, ...theme.type.body, color: c.label }}>
            <Icon icon={stopped ? CircleSlash : Repeat} size={16} style={{ color: c.labelSecondary }} />
            {stopped ? 'This expense no longer repeats.' : `Repeats ${label.toLowerCase()}`}
          </div>
          <p style={{ ...theme.type.footnote, color: c.labelSecondary, margin: '4px 0 0' }}>
            How often it repeats can't be changed. Changes here only affect this one expense.
          </p>
          {canStop && !stopped && (
            <Button variant="danger" icon={CircleSlash} onClick={onStop} loading={stopping} style={{ marginTop: theme.spacing.md }}>
              {glossary.stopRepeating}
            </Button>
          )}
        </>
      )}
    </SectionCard>
  );
}
