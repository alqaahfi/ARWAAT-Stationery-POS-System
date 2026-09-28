import React from 'react';
import theme from '../../config/theme';
import useInteraction, { mergeHandlers } from './useInteraction';
import { Icon } from './Icon';
import { Spinner } from './Feedback';

const c = theme.colors;

// [rest, hover] per variant. "secondary" and "ghost" are the legacy names
// still used by existing pages (quiet gray button / plain text button).
const VARIANTS = {
  primary: [{ backgroundColor: c.accent, color: c.labelOnAccent }, { backgroundColor: c.accentPressed }],
  tinted: [{ backgroundColor: c.accentTint, color: c.accent }, { backgroundColor: c.accentTintStrong }],
  plain: [{ backgroundColor: 'transparent', color: c.accent }, { backgroundColor: c.fill }],
  secondary: [{ backgroundColor: c.fill, color: c.label }, { backgroundColor: c.fillStrong }],
  danger: [{ backgroundColor: c.redTint, color: c.redText }, { backgroundColor: c.redTintStrong }],
  dangerFilled: [{ backgroundColor: c.red, color: c.labelOnAccent }, { backgroundColor: c.redPressed }],
};
VARIANTS.ghost = VARIANTS.plain;

const SIZES = {
  sm: { height: theme.control.sm, padding: '0 10px', fontSize: theme.type.subhead.fontSize, gap: '4px', icon: 16 },
  md: { height: theme.control.md, padding: '0 14px', fontSize: theme.type.body.fontSize, gap: '6px', icon: 16 },
  lg: { height: theme.control.lg, padding: '0 18px', fontSize: theme.type.headline.fontSize, gap: '8px', icon: 18 },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  style,
  ...rest
}) {
  const inactive = disabled || loading;
  const { hovered, pressed, handlers } = useInteraction(inactive);
  const [base, hover] = VARIANTS[variant] || VARIANTS.primary;
  const s = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      {...rest}
      {...mergeHandlers(handlers, rest)}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        width: fullWidth ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        height: s.height,
        minHeight: s.height,
        padding: s.padding,
        boxSizing: 'border-box',
        border: 'none',
        borderRadius: theme.radius.sm,
        fontFamily: theme.font.family,
        fontSize: s.fontSize,
        fontWeight: theme.font.weightSemibold,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : loading ? 'progress' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transform: pressed ? 'scale(0.98)' : 'none',
        transition: `background-color ${theme.motion.fast} ease, transform ${theme.motion.fast} ${theme.motion.easing}`,
        ...base,
        ...(hovered || pressed ? hover : null),
        ...style,
      }}
    >
      {loading ? <Spinner size={s.icon} /> : icon && <Icon icon={icon} size={s.icon} />}
      {children}
      {iconRight && !loading && <Icon icon={iconRight} size={s.icon} />}
    </button>
  );
}

// Icon-only button. `label` is required: it becomes the tooltip and the
// screen-reader name.
export function IconButton({ icon, label, size = 'md', tone = 'default', disabled, style, ...rest }) {
  const { hovered, pressed, handlers } = useInteraction(disabled);
  const s = SIZES[size] || SIZES.md;
  const color = tone === 'danger' ? c.redText : tone === 'accent' ? c.accent : c.labelSecondary;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      {...rest}
      {...mergeHandlers(handlers, rest)}
      style={{
        width: s.height,
        height: s.height,
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? c.fillStrong : hovered ? c.fill : 'transparent',
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: `background-color ${theme.motion.fast} ease`,
        flexShrink: 0,
        ...style,
      }}
    >
      <Icon icon={icon} size={size === 'lg' ? 20 : 18} />
    </button>
  );
}
