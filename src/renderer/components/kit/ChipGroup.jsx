import React, { useRef } from 'react';
import theme from '../../config/theme';
import { Icon } from './Icon';

const c = theme.colors;
const SIZES = { md: { height: theme.control.md, pad: '0 14px', icon: 16 }, lg: { height: '48px', pad: '0 18px', icon: 20 } };

// Single-select pill buttons. options: [{ value, label, icon? }].
// Arrow keys move and select; Tab enters/leaves the group as one stop.
export function ChipGroup({ options, value, onChange, size = 'md', 'aria-label': ariaLabel, id, style }) {
  const refs = useRef([]);
  const s = SIZES[size] || SIZES.md;
  const hasSelection = options.some((o) => o.value === value);

  function onKeyDown(e, index) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange?.(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label={ariaLabel} id={id} style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm, ...style }}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!hasSelection && i === 0) ? 0 : -1}
            onClick={() => onChange?.(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: s.height,
              padding: s.pad,
              boxSizing: 'border-box',
              borderRadius: theme.radius.pill,
              border: `1px solid ${selected ? c.accent : c.separatorStrong}`,
              backgroundColor: selected ? c.accentTint : c.surface,
              color: selected ? c.accent : c.label,
              fontFamily: theme.font.family,
              fontSize: size === 'lg' ? theme.type.headline.fontSize : theme.type.subhead.fontSize,
              fontWeight: selected ? theme.font.weightSemibold : theme.font.weightMedium,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: `background-color ${theme.motion.fast} ease, border-color ${theme.motion.fast} ease`,
            }}
          >
            {opt.icon && <Icon icon={opt.icon} size={s.icon} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
