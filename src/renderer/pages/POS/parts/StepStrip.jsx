import React from 'react';
import { Check } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, Kbd } from '../../../components/ui';
import { c, keepFocus } from './common';

const STEPS = ['Customer', 'Items', 'Discount', 'Payment'];

// Which step each stage belongs to. idle = nothing started, confirm = all done.
const STEP_OF_STAGE = {
  idle: -1,
  customer: 0,
  'item-search': 1,
  qty: 1,
  'cart-edit': 1,
  discount: 2,
  format: 3,
  payment: 3,
  confirm: STEPS.length,
};

export default function StepStrip({ stage, showCancel, onCancel, heldCount = 0, canHold, onRecent, onHold, onRecall }) {
  const current = STEP_OF_STAGE[stage] ?? -1;
  return (
    <div style={styles.bar}>
      <ol style={styles.list} aria-label="Sale steps">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} style={styles.item} aria-current={active ? 'step' : undefined}>
              {i > 0 && <span aria-hidden="true" style={{ ...styles.line, backgroundColor: done || active ? c.green : c.separatorStrong }} />}
              <span
                style={{
                  ...styles.dot,
                  backgroundColor: done ? c.green : active ? c.accent : c.fill,
                  color: done || active ? c.labelOnAccent : c.labelSecondary,
                }}
              >
                {done ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span
                style={{
                  ...theme.type.subhead,
                  color: done || active ? c.label : c.labelSecondary,
                  fontWeight: active ? theme.font.weightSemibold : theme.font.weightMedium,
                }}
              >
                {label}
                {done && <span style={styles.srOnly}> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
        {stage !== 'confirm' && (
          <>
            <Button variant="secondary" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onRecent}>
              Today's bills <Kbd>F2</Kbd>
            </Button>
            <Button variant="secondary" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onRecall}>
              Held{heldCount > 0 ? ` (${heldCount})` : ''} <Kbd>F3</Kbd>
            </Button>
            {canHold && (
              <Button variant="secondary" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onHold}>
                Hold <Kbd>F4</Kbd>
              </Button>
            )}
          </>
        )}
        {showCancel && (
          <Button variant="danger" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onCancel}>
            Cancel sale <Kbd>Esc</Kbd>
          </Button>
        )}
      </div>
    </div>
  );
}

const styles = {
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, minHeight: '32px', flexShrink: 0 },
  list: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, listStyle: 'none', margin: 0, padding: 0 },
  item: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  line: { width: '32px', height: '2px', borderRadius: theme.radius.pill },
  dot: {
    width: '22px',
    height: '22px',
    borderRadius: theme.radius.pill,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.type.caption,
    fontWeight: theme.font.weightBold,
    flexShrink: 0,
  },
  srOnly: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' },
};
