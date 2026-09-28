import React, { useId, useRef } from 'react';
import { ChevronDown, CircleAlert, Search, X } from 'lucide-react';
import theme from '../../config/theme';
import { Icon } from './Icon';

const c = theme.colors;

// --- Labels & messages --------------------------------------------------

export function Label({ children, htmlFor, style }) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: 'block',
        ...theme.type.subhead,
        fontWeight: theme.font.weightMedium,
        color: c.label,
        marginTop: theme.spacing.md,
        marginBottom: '6px',
        ...style,
      }}
    >
      {children}
    </label>
  );
}

export function FieldError({ children, id }) {
  if (!children) return null;
  return (
    <div id={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: c.redText, ...theme.type.footnote, marginTop: '6px' }}>
      <Icon icon={CircleAlert} size={14} />
      <span>{children}</span>
    </div>
  );
}

export function HelperText({ children, id }) {
  return <div id={id} style={{ color: c.labelSecondary, ...theme.type.footnote, marginTop: '6px' }}>{children}</div>;
}

// Wraps exactly one control: label above, hint or error below. Wires the
// control's id / aria-invalid / aria-describedby automatically.
export function Field({ label, hint, error, required, children, style }) {
  const autoId = useId();
  const child = React.Children.only(children);
  const id = child.props.id || autoId;
  const msgId = `${id}-msg`;
  const control = React.cloneElement(child, {
    id,
    'aria-invalid': error ? true : child.props['aria-invalid'],
    'aria-describedby': error || hint ? msgId : undefined,
  });
  return (
    <div style={{ marginBottom: theme.spacing.md, ...style }}>
      {label && (
        <Label htmlFor={id} style={{ marginTop: 0 }}>
          {label}
          {required && <span style={{ color: c.redText }}> *</span>}
        </Label>
      )}
      {control}
      {error ? <FieldError id={msgId}>{error}</FieldError> : hint ? <HelperText id={msgId}>{hint}</HelperText> : null}
    </div>
  );
}

// --- Controls ------------------------------------------------------------

function isInvalid(props) {
  return props['aria-invalid'] === true || props['aria-invalid'] === 'true';
}

function fieldStyle(props) {
  return {
    width: '100%',
    height: theme.control.input,
    padding: '0 11px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.md,
    border: `1px solid ${isInvalid(props) ? c.red : c.separatorStrong}`,
    backgroundColor: props.disabled ? c.fill : c.surface,
    color: props.disabled ? c.labelSecondary : c.label,
    fontFamily: theme.font.family,
    ...theme.type.body,
    outline: 'none',
    transition: `border-color ${theme.motion.fast} ease, box-shadow ${theme.motion.fast} ease`,
  };
}

export function TextInput({ style, ...props }) {
  return <input data-ui-input="" {...props} style={{ ...fieldStyle(props), ...style }} />;
}

// Text input tuned for amounts/quantities: right-aligned tabular numerals.
// onChange still receives the event; parse the value in the caller.
export function NumberInput({ style, ...props }) {
  return (
    <input
      data-ui-input=""
      type="text"
      inputMode="decimal"
      autoComplete="off"
      {...props}
      style={{ ...fieldStyle(props), textAlign: 'right', ...theme.font.numeric, ...style }}
    />
  );
}

export function TextArea({ style, ...props }) {
  return (
    <textarea
      data-ui-input=""
      {...props}
      style={{ ...fieldStyle(props), height: 'auto', minHeight: '76px', padding: '8px 11px', resize: 'vertical', ...style }}
    />
  );
}
export const Textarea = TextArea;

// Layout keys from a caller's style go on the wrapper so the chevron stays
// inside the visible box; the rest go on the <select> itself.
const WRAPPER_KEYS = ['width', 'minWidth', 'maxWidth', 'flex', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'alignSelf'];

export function Select({ style = {}, children, ...props }) {
  const wrap = {};
  const own = {};
  for (const [k, v] of Object.entries(style)) (WRAPPER_KEYS.includes(k) ? wrap : own)[k] = v;
  return (
    <div style={{ position: 'relative', width: '100%', ...wrap }}>
      <select
        data-ui-input=""
        {...props}
        style={{ ...fieldStyle(props), appearance: 'none', paddingRight: '32px', cursor: props.disabled ? 'not-allowed' : 'pointer', ...own }}
      >
        {children}
      </select>
      <Icon
        icon={ChevronDown}
        size={16}
        style={{ position: 'absolute', right: '10px', top: '50%', marginTop: '-8px', color: c.labelSecondary, pointerEvents: 'none' }}
      />
    </div>
  );
}

// Search box with magnifier and clear button. Esc clears.
// onChange receives the new string (not an event) so "clear" can use it too.
export function SearchField({ value, onChange, placeholder = 'Search', style, inputStyle, onKeyDown, ...props }) {
  const ref = useRef(null);
  function clear() {
    onChange?.('');
    ref.current?.focus();
  }
  return (
    <div style={{ position: 'relative', width: '100%', ...style }}>
      <Icon
        icon={Search}
        size={16}
        style={{ position: 'absolute', left: '10px', top: '50%', marginTop: '-8px', color: c.labelSecondary, pointerEvents: 'none' }}
      />
      <input
        ref={ref}
        data-ui-input=""
        type="text"
        role="searchbox"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.stopPropagation();
            clear();
          }
          onKeyDown?.(e);
        }}
        {...props}
        style={{ ...fieldStyle(props), backgroundColor: props.disabled ? c.fill : c.surface, paddingLeft: '32px', paddingRight: '32px', ...inputStyle }}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          title="Clear (Esc)"
          onClick={clear}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            marginTop: '-9px',
            width: '18px',
            height: '18px',
            padding: 0,
            border: 'none',
            borderRadius: theme.radius.pill,
            backgroundColor: c.labelTertiary,
            color: c.labelOnAccent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={12} strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
