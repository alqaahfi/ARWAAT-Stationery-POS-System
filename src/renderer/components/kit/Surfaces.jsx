import React from 'react';
import { ChevronRight, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import theme from '../../config/theme';
import useInteraction from './useInteraction';
import { Icon, IconTile } from './Icon';

const c = theme.colors;

export function Card({ children, title, footer, padding = theme.spacing.md, style }) {
  return (
    <div
      style={{
        backgroundColor: c.surface,
        border: `1px solid ${c.separator}`,
        borderRadius: theme.radius.lg,
        fontFamily: theme.font.family,
        overflow: title || footer ? 'hidden' : undefined,
        ...(title || footer ? null : { padding }),
        ...style,
      }}
    >
      {title || footer ? (
        <>
          {title && (
            <div style={{ ...theme.type.headline, color: c.label, padding: `14px ${padding} 0` }}>{title}</div>
          )}
          <div style={{ padding }}>{children}</div>
          {footer && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: theme.spacing.sm,
                padding: `${theme.spacing.smd} ${padding}`,
                borderTop: `1px solid ${c.separator}`,
                backgroundColor: c.surfaceAlt,
              }}
            >
              {footer}
            </div>
          )}
        </>
      ) : (
        children
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ ...theme.type.title2, color: c.label, margin: 0 }}>{title}</h3>
        {subtitle && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', gap: theme.spacing.sm, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

const BANNER_TONES = {
  error: { color: 'red', icon: CircleAlert },
  critical: { color: 'red', icon: CircleAlert },
  warning: { color: 'orange', icon: TriangleAlert },
  success: { color: 'green', icon: CircleCheck },
  info: { color: 'blue', icon: Info },
};

export function Banner({ children, tone = 'error', style }) {
  if (!children) return null;
  const t = BANNER_TONES[tone] || BANNER_TONES.info;
  return (
    <div
      role={t.color === 'red' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.md,
        padding: '10px 12px',
        borderRadius: theme.radius.md,
        backgroundColor: c[`${t.color}Tint`],
        color: c[`${t.color}Text`],
        ...theme.type.subhead,
        ...style,
      }}
    >
      <Icon icon={t.icon} size={16} style={{ marginTop: '1px' }} />
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

const BADGE_TONES = { neutral: 'gray', blue: 'blue', green: 'green', orange: 'orange', red: 'red', purple: 'purple' };

export function Badge({ children, tone = 'neutral', dot = false, size = 'md', style }) {
  const color = BADGE_TONES[tone] || 'gray';
  const sm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        height: sm ? '18px' : '22px',
        padding: sm ? '0 6px' : '0 8px',
        borderRadius: theme.radius.pill,
        backgroundColor: c[`${color}Tint`],
        color: c[`${color}Text`],
        fontSize: sm ? theme.type.caption.fontSize : theme.type.footnote.fontSize,
        fontWeight: theme.font.weightSemibold,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {dot && <span aria-hidden="true" style={{ width: '6px', height: '6px', borderRadius: theme.radius.pill, backgroundColor: c[color] }} />}
      {children}
    </span>
  );
}

export function Kbd({ children }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '20px',
        height: '20px',
        padding: '0 5px',
        boxSizing: 'border-box',
        borderRadius: '5px',
        border: `1px solid ${c.separatorStrong}`,
        borderBottomWidth: '2px',
        backgroundColor: c.surface,
        color: c.labelSecondary,
        fontFamily: theme.font.family,
        fontSize: theme.type.caption.fontSize,
        fontWeight: theme.font.weightSemibold,
        lineHeight: 1,
      }}
    >
      {children}
    </kbd>
  );
}

// --- Grouped-inset list (iOS Settings style) ---------------------------

const ROW_PAD = 16;
const TILE = 30;
const TILE_GAP = 12;

export function ListSection({ title, footer, children, style }) {
  const rows = React.Children.toArray(children).filter(React.isValidElement);
  return (
    <section style={{ marginBottom: theme.spacing.lg, ...style }}>
      {title && (
        <div
          style={{
            ...theme.type.footnote,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: c.labelSecondary,
            padding: `0 ${ROW_PAD}px 6px`,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ backgroundColor: c.surface, borderRadius: theme.radius.lg, border: `1px solid ${c.separator}`, overflow: 'hidden' }}>
        {rows.map((row, i) => React.cloneElement(row, { separator: i > 0 }))}
      </div>
      {footer && <div style={{ ...theme.type.footnote, color: c.labelSecondary, padding: `6px ${ROW_PAD}px 0` }}>{footer}</div>}
    </section>
  );
}

// icon + color: a Lucide component and palette name, e.g. {...appIcons.printer}.
// trailing: any node (Toggle, Badge, Button). chevron: shows ">" for drill-in.
export function ListRow({ icon, color = 'gray', title, subtitle, value, trailing, chevron, onClick, destructive, disabled, separator }) {
  const clickable = !!onClick && !disabled;
  const { hovered, pressed, handlers } = useInteraction(!clickable);
  const inset = icon ? ROW_PAD + TILE + TILE_GAP : ROW_PAD;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-disabled={disabled || undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      {...handlers}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: `${TILE_GAP}px`,
        minHeight: theme.control.row,
        padding: `6px ${ROW_PAD}px`,
        boxSizing: 'border-box',
        backgroundColor: pressed ? c.fill : hovered ? c.surfaceAlt : c.surface,
        cursor: clickable ? 'pointer' : 'default',
        opacity: disabled ? 0.4 : 1,
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      {separator && (
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: inset, right: 0, height: '1px', backgroundColor: c.separator }} />
      )}
      {icon && <IconTile icon={icon} color={destructive ? 'red' : color} size="md" />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...theme.type.body, color: destructive ? c.redText : c.label }}>{title}</div>
        {subtitle && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '1px' }}>{subtitle}</div>}
      </div>
      {value != null && <div style={{ ...theme.type.body, ...theme.font.numeric, color: c.labelSecondary, whiteSpace: 'nowrap' }}>{value}</div>}
      {trailing}
      {chevron && <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary, marginRight: '-4px' }} />}
    </div>
  );
}
