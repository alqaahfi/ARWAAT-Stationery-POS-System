import React from 'react';
import { Check } from 'lucide-react';
import theme from '../../config/theme';

const c = theme.colors;

// Display-only horizontal steps. `steps` is a list of labels; `current` is
// the index of the step in progress (steps before it show as done; pass
// steps.length to show every step done).
export function Stepper({ steps, current = 0, style }) {
  return (
    <ol
      aria-label="Progress"
      style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, listStyle: 'none', margin: 0, padding: 0, fontFamily: theme.font.family, ...style }}
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            {i > 0 && (
              <li aria-hidden="true" style={{ flex: 1, minWidth: '16px', height: '1px', backgroundColor: done || active ? c.separatorStrong : c.separator }} />
            )}
            <li aria-current={active ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: '24px',
                  height: '24px',
                  boxSizing: 'border-box',
                  borderRadius: theme.radius.pill,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...theme.type.footnote,
                  ...theme.font.numeric,
                  fontWeight: theme.font.weightSemibold,
                  backgroundColor: done ? c.green : active ? c.accent : 'transparent',
                  border: done || active ? 'none' : `1.5px solid ${c.separatorStrong}`,
                  color: done || active ? c.labelOnAccent : c.labelTertiary,
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span
                style={{
                  ...theme.type.subhead,
                  fontWeight: active ? theme.font.weightSemibold : theme.font.weightMedium,
                  color: active || done ? c.label : c.labelTertiary,
                }}
              >
                {label}
                {done && <span style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}> (done)</span>}
              </span>
            </li>
          </React.Fragment>
        );
      })}
    </ol>
  );
}
