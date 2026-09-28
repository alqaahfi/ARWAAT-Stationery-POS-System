import React, { useRef } from 'react';
import { Check } from 'lucide-react';
import theme from '../../config/theme';
import { Icon } from './Icon';

const c = theme.colors;

// iOS switch. onChange receives the new boolean.
export function Toggle({ checked, onChange, disabled, label, id, style }) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      style={{
        position: 'relative',
        width: '44px',
        height: '26px',
        padding: 0,
        border: 'none',
        borderRadius: theme.radius.pill,
        backgroundColor: checked ? c.green : c.fillStrong,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: `background-color ${theme.motion.base} ease`,
        flexShrink: 0,
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '2px',
          left: '2px',
          width: '22px',
          height: '22px',
          borderRadius: theme.radius.pill,
          backgroundColor: c.surface,
          boxShadow: theme.shadow.knob,
          transform: checked ? 'translateX(18px)' : 'translateX(0)',
          transition: `transform ${theme.motion.base} ${theme.motion.easing}`,
        }}
      />
    </button>
  );
}

// 18px checkbox. Keeps the legacy API: onChange receives the native event
// (read e.target.checked).
export function Checkbox({ label, checked, onChange, disabled, id, style }) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'flex',
        width: 'fit-content',
        alignItems: 'center',
        gap: theme.spacing.sm,
        color: c.label,
        ...theme.type.body,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        marginTop: theme.spacing.md,
        userSelect: 'none',
        ...style,
      }}
    >
      <input
        type="checkbox"
        data-ui-check=""
        id={id}
        checked={!!checked}
        onChange={onChange}
        disabled={disabled}
        style={{ position: 'absolute', opacity: 0, width: '1px', height: '1px', margin: 0, pointerEvents: 'none' }}
      />
      <span
        data-ui-check-box=""
        aria-hidden="true"
        style={{
          width: '18px',
          height: '18px',
          boxSizing: 'border-box',
          borderRadius: '5px',
          border: checked ? 'none' : `1.5px solid ${c.separatorStrong}`,
          backgroundColor: checked ? c.accent : c.surface,
          color: c.labelOnAccent,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: `background-color ${theme.motion.fast} ease`,
        }}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

// options: [{ value, label, icon? }]. Arrow keys move the selection.
export function SegmentedControl({ options, value, onChange, size = 'md', fullWidth = false, label, style }) {
  const refs = useRef([]);
  const height = size === 'sm' ? theme.control.sm : theme.control.md;

  function onKeyDown(e, index) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange?.(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        padding: '2px',
        gap: '2px',
        height,
        boxSizing: 'border-box',
        borderRadius: theme.radius.sm,
        backgroundColor: c.fill,
        ...style,
      }}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        // Keep one option reachable by Tab even when nothing is selected.
        const focusable = selected || (i === 0 && !options.some((o) => o.value === value));
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={focusable ? 0 : -1}
            onClick={() => onChange?.(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              flex: fullWidth ? 1 : undefined,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '0 12px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: selected ? c.surface : 'transparent',
              boxShadow: selected ? theme.shadow.segment : 'none',
              color: c.label,
              fontFamily: theme.font.family,
              fontSize: size === 'sm' ? theme.type.footnote.fontSize : theme.type.subhead.fontSize,
              fontWeight: selected ? theme.font.weightSemibold : theme.font.weightMedium,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: `background-color ${theme.motion.fast} ease, box-shadow ${theme.motion.fast} ease`,
            }}
          >
            {opt.icon && <Icon icon={opt.icon} size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
