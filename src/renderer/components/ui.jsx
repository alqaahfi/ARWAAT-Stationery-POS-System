import React from 'react';
import theme from '../config/theme';

export function Card({ children, style }) {
  return (
    <div
      style={{
        backgroundColor: theme.colors.cardBackground,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.radius.lg,
        boxShadow: theme.shadow.card,
        padding: theme.spacing.md,
        fontFamily: theme.font.family,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
      <h3 style={{ color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, margin: 0 }}>{title}</h3>
      {actions && <div style={{ display: 'flex', gap: theme.spacing.sm }}>{actions}</div>}
    </div>
  );
}

export function Label({ children }) {
  return (
    <label style={{ display: 'block', fontSize: theme.font.sizeSm, color: theme.colors.textSecondary, marginTop: theme.spacing.md, marginBottom: theme.spacing.xs }}>
      {children}
    </label>
  );
}

const fieldBase = {
  width: '100%',
  padding: '9px 10px',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: theme.colors.cardBackground,
  color: theme.colors.textPrimary,
  fontSize: theme.font.sizeBase,
  boxSizing: 'border-box',
  fontFamily: theme.font.family,
  outline: 'none',
};

export function TextInput({ style, ...props }) {
  return (
    <input
      {...props}
      style={{ ...fieldBase, ...style }}
      onFocus={(e) => {
        e.target.style.borderColor = theme.colors.primary;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = theme.colors.border;
        props.onBlur?.(e);
      }}
    />
  );
}

export function TextArea({ style, ...props }) {
  return (
    <textarea
      {...props}
      style={{ ...fieldBase, minHeight: '70px', resize: 'vertical', fontSize: theme.font.sizeSm, ...style }}
      onFocus={(e) => {
        e.target.style.borderColor = theme.colors.primary;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.target.style.borderColor = theme.colors.border;
        props.onBlur?.(e);
      }}
    />
  );
}

export function Select({ style, children, ...props }) {
  return (
    <select {...props} style={{ ...fieldBase, ...style }}>
      {children}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, style }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
        color: theme.colors.textPrimary,
        fontSize: theme.font.sizeBase,
        cursor: 'pointer',
        marginTop: theme.spacing.md,
        ...style,
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

const buttonVariants = {
  primary: { backgroundColor: theme.colors.primary, color: theme.colors.primaryText, border: '1px solid transparent' },
  secondary: { backgroundColor: theme.colors.cardBackground, color: theme.colors.textPrimary, border: `1px solid ${theme.colors.borderStrong}` },
  danger: { backgroundColor: theme.colors.dangerBackground, color: theme.colors.danger, border: `1px solid ${theme.colors.danger}` },
  ghost: { backgroundColor: 'transparent', color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}` },
};
const buttonHoverVariants = {
  primary: { backgroundColor: theme.colors.primaryHover },
  secondary: { backgroundColor: theme.colors.appBackground },
  danger: { backgroundColor: theme.colors.dangerBackground },
  ghost: { backgroundColor: theme.colors.appBackground },
};

export function Button({ children, onClick, variant = 'primary', type = 'button', disabled, style }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '9px 16px',
        borderRadius: theme.radius.md,
        fontSize: theme.font.sizeBase,
        fontFamily: theme.font.family,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background-color 0.15s ease',
        ...buttonVariants[variant],
        ...style,
      }}
      onMouseEnter={(e) => !disabled && Object.assign(e.currentTarget.style, buttonHoverVariants[variant])}
      onMouseLeave={(e) => !disabled && Object.assign(e.currentTarget.style, buttonVariants[variant])}
    >
      {children}
    </button>
  );
}

export function Banner({ children, tone = 'error' }) {
  if (!children) return null;
  const toneStyle =
    tone === 'error'
      ? { backgroundColor: theme.colors.dangerBackground, color: theme.colors.danger, border: `1px solid ${theme.colors.danger}` }
      : { backgroundColor: theme.colors.infoBackground, color: theme.colors.info, border: `1px solid ${theme.colors.info}` };
  return (
    <div style={{ marginTop: theme.spacing.md, padding: '10px 14px', borderRadius: theme.radius.sm, fontSize: theme.font.sizeSm, ...toneStyle }}>
      {children}
    </div>
  );
}

export function FieldError({ children }) {
  if (!children) return null;
  return <div style={{ color: theme.colors.danger, fontSize: theme.font.sizeXs, marginTop: '4px' }}>{children}</div>;
}

export function HelperText({ children }) {
  return <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '4px' }}>{children}</div>;
}

// Plain <tr> with the spec's subtle hover tint — no shadow/scale, just a
// flat background swap — so list pages don't each reimplement it.
export function Tr({ children, onClick, style }) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'background-color 0.15s ease', ...style }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </tr>
  );
}

export const tableStyles = {
  scroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.sizeSm },
  th: {
    textAlign: 'left',
    color: theme.colors.textSecondary,
    fontWeight: theme.font.weightSemibold,
    padding: '10px 14px',
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: '#f8fafc',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '11px 14px',
    color: theme.colors.textPrimary,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  emptyState: { color: theme.colors.textSecondary, padding: '32px 20px', textAlign: 'center', fontSize: theme.font.sizeBase },
};
