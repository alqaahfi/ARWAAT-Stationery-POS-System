import React from 'react';
import theme from '../../../config/theme';
import { NumberInput, Spinner, TextInput } from '../../../components/ui';

const c = theme.colors;

// Moves focus to the next field inside the product form (used instead of
// submitting on Enter — barcode scanners press Enter after every scan).
export function focusNextField(from) {
  const root = from.closest('[data-product-form]') || document;
  const items = [...root.querySelectorAll('input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])')].filter(
    (el) => el.offsetParent !== null && !el.closest('[data-ui-check-box]') && el.getAttribute('data-ui-check') === null
  );
  const next = items[items.indexOf(from) + 1];
  if (next) next.focus();
  else from.blur();
}

// Amount / quantity box: right-aligned tabular digits, selects everything on
// focus, digits and one dot only. Type "text" so the mouse wheel never
// changes it. onChange receives the cleaned string.
export function NumInput({ value, onChange, allowDecimal = true, onFocus, ...rest }) {
  return (
    <NumberInput
      value={value ?? ''}
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      onFocus={(e) => {
        e.target.select();
        onFocus?.(e);
      }}
      onChange={(e) => {
        let v = e.target.value.replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '');
        const dot = v.indexOf('.');
        if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
        onChange(v);
      }}
      {...rest}
    />
  );
}

// Text box with a small spinner while a uniqueness check runs. With
// `scanner`, Enter never submits — it moves to the next field (the blur
// runs the check).
export function CheckedInput({ checking, scanner = false, style, onKeyDown, ...rest }) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <TextInput
        autoComplete="off"
        spellCheck={false}
        onKeyDown={(e) => {
          if (scanner && e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            focusNextField(e.currentTarget);
          }
          onKeyDown?.(e);
        }}
        {...rest}
        style={{ paddingRight: checking ? '34px' : undefined }}
      />
      {checking && <Spinner size={14} style={{ position: 'absolute', right: '12px', top: '50%', marginTop: '-7px', color: c.labelSecondary }} />}
    </div>
  );
}

// White card with a title and optional one-line intro.
export function SectionCard({ title, intro, children, style, dense }) {
  return (
    <section style={{ backgroundColor: c.surface, border: `1px solid ${c.separator}`, borderRadius: theme.radius.lg, padding: dense ? theme.spacing.smd : theme.spacing.md, ...style }}>
      {title && <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>{title}</h2>}
      {intro && <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: '4px 0 0' }}>{intro}</p>}
      <div style={{ marginTop: title || intro ? (dense ? theme.spacing.sm : theme.spacing.md) : 0 }}>{children}</div>
    </section>
  );
}

export function Intro({ children }) {
  return <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: `0 0 ${theme.spacing.md}` }}>{children}</p>;
}

export const grid = (min = 200) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, columnGap: theme.spacing.md });
