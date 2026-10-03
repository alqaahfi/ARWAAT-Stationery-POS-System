import React from 'react';
import { CircleAlert, Info } from 'lucide-react';
import theme from '../../../../config/theme';
import glossary from '../../../../config/glossary';
import BalanceChip from '../../../../components/BalanceChip';
import { Card, Field, Icon, NumberInput, SegmentedControl } from '../../../../components/ui';
import { formatCurrencyExact } from '../../../../utils/format';
import { SaleSummaryLine } from './ItemsStep';
import { round2 } from './returnUtils';

const c = theme.colors;

// Step 3: how the customer gets their money back. `cash` is the parsed amount
// that will go back in cash; `cap` is the most that may (see returnUtils.cashCap).
export function RefundStep({ data, total, cap, mode, onMode, cashInput, onCashInput, cash, error }) {
  const { customer } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxWidth: '640px' }}>
      <SaleSummaryLine sale={data.sale} customer={customer} />

      <Card>
        <div style={styles.valueRow}>
          <span style={{ ...theme.type.body, color: c.labelSecondary }}>Value of returned items</span>
          <span style={{ ...theme.type.title2, ...theme.font.numeric, color: c.label }}>{formatCurrencyExact(total)}</span>
        </div>

        {customer ? (
          <NamedRefund customer={customer} total={total} cap={cap} mode={mode} onMode={onMode} cashInput={cashInput} onCashInput={onCashInput} cash={cash} />
        ) : (
          <div style={{ marginTop: theme.spacing.md }}>
            <div style={styles.info}>
              <Icon icon={Info} size={18} />
              <span>Walk-in customers have no account, so this is paid back in cash.</span>
            </div>
            <div style={{ ...styles.valueRow, marginTop: theme.spacing.smd }}>
              <span style={{ color: c.label }}>Cash back</span>
              <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold }}>{formatCurrencyExact(total)}</span>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div role="alert" style={styles.errorBox}>
          <Icon icon={CircleAlert} size={18} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function NamedRefund({ customer, total, cap, mode, onMode, cashInput, onCashInput, cash }) {
  const cashAllowed = cap > 0;
  const options = [
    { value: 'cash', label: glossary.giveCashBack },
    { value: 'account', label: glossary.takeOffAccount },
  ];
  const credited = round2(total - (mode === 'cash' ? cash : 0));
  const after = round2(customer.balance - total + (mode === 'cash' ? cash : 0));
  const over = mode === 'cash' && cash > cap + 0.004;

  return (
    <div style={{ marginTop: theme.spacing.md, display: 'flex', flexDirection: 'column', gap: theme.spacing.smd }}>
      <div style={styles.valueRow}>
        <span style={{ color: c.labelSecondary }}>{customer.name} — current balance</span>
        <BalanceChip amount={customer.balance} />
      </div>

      {cashAllowed ? (
        <SegmentedControl options={options} value={mode} onChange={onMode} label="How to refund" fullWidth />
      ) : (
        <>
          <LockedChoice options={options} />
          <div style={styles.hint}>They still owe you money, so this return reduces what they owe.</div>
        </>
      )}

      {mode === 'cash' && cashAllowed && (
        <Field
          label="Cash back"
          hint={`Up to ${formatCurrencyExact(cap)}`}
          error={over ? `Cash back can be at most ${formatCurrencyExact(cap)}.` : undefined}
          style={{ marginBottom: 0 }}
        >
          <NumberInput
            value={cashInput}
            onChange={(e) => onCashInput(e.target.value)}
            onFocus={(e) => e.target.select()}
            onWheel={(e) => e.currentTarget.blur()}
            style={{ width: '180px' }}
          />
        </Field>
      )}

      <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.label }}>
          Cash back {formatCurrencyExact(mode === 'cash' ? cash : 0)} · Credited to their account {formatCurrencyExact(credited)}
        </div>
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'baseline' }}>
          Their balance will change from <BalanceChip amount={customer.balance} /> to <BalanceChip amount={after} />
        </div>
      </div>
    </div>
  );
}

// Same look as the SegmentedControl, with "Give cash back" shown but disabled
// (the kit control has no per-option disabled state).
function LockedChoice({ options }) {
  return (
    <div role="radiogroup" aria-label="How to refund" style={styles.segment}>
      {options.map((opt) => {
        const selected = opt.value === 'account';
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!selected}
            tabIndex={selected ? 0 : -1}
            style={{
              ...styles.segmentBtn,
              backgroundColor: selected ? c.surface : 'transparent',
              boxShadow: selected ? theme.shadow.segment : 'none',
              fontWeight: selected ? theme.font.weightSemibold : theme.font.weightMedium,
              color: selected ? c.label : c.labelTertiary,
              cursor: selected ? 'default' : 'not-allowed',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  segment: {
    display: 'flex',
    padding: '2px',
    gap: '2px',
    height: theme.control.md,
    boxSizing: 'border-box',
    borderRadius: theme.radius.sm,
    backgroundColor: c.fill,
  },
  segmentBtn: {
    flex: 1,
    padding: '0 12px',
    border: 'none',
    borderRadius: '6px',
    fontFamily: theme.font.family,
    fontSize: theme.type.subhead.fontSize,
    whiteSpace: 'nowrap',
  },
  valueRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: theme.spacing.md, flexWrap: 'wrap' },
  info: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, color: c.labelSecondary, ...theme.type.subhead },
  hint: { ...theme.type.footnote, color: c.labelSecondary },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    backgroundColor: c.redTint,
    color: c.redText,
    ...theme.type.subhead,
  },
};
