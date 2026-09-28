import React, { useEffect, useRef } from 'react';
import theme from '../../config/theme';
import useInteraction, { mergeHandlers } from './useInteraction';
import { Icon, IconTile } from './Icon';

const c = theme.colors;

// --- Popover ---------------------------------------------------------------

// Dropdown anchored under its trigger. `anchor` is the trigger element (it
// toggles `open` itself). Closes on outside click and Esc; Esc and picking a
// menu item put focus back on the trigger. `children` may be a function that
// receives `close` so items can close the popover after acting.
export function Popover({ open, onClose, anchor, children, align = 'end', width = 260, style }) {
  const wrapRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  function close(restoreFocus = true) {
    onCloseRef.current?.();
    if (restoreFocus) wrapRef.current?.querySelector('button')?.focus();
  }
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return undefined;
    function onMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeRef.current(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeRef.current(true);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {anchor}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            [align === 'start' ? 'left' : 'right']: 0,
            width,
            maxHeight: '420px',
            overflowY: 'auto',
            padding: '6px',
            boxSizing: 'border-box',
            backgroundColor: c.surface,
            borderRadius: theme.radius.lg,
            boxShadow: theme.shadow.popover,
            fontFamily: theme.font.family,
            zIndex: 60,
            animation: `pop-in ${theme.motion.fast} ${theme.motion.easing}`,
            ...style,
          }}
        >
          {typeof children === 'function' ? children(close) : children}
        </div>
      )}
    </div>
  );
}

// --- Menu ------------------------------------------------------------------

// Wraps MenuItems: ↑/↓ move between them (Enter activates the focused one,
// as any button does). Focuses the first item when it appears.
export function Menu({ children, label, autoFocus = true, style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) ref.current?.querySelector('[role="menuitem"]')?.focus();
  }, [autoFocus]);

  function onKeyDown(e) {
    // Keys pressed inside a menu belong to the menu, not to page-level
    // listeners (e.g. Enter in Cashier Mode).
    e.stopPropagation();
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    let next;
    if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else next = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  return (
    <div ref={ref} role="menu" aria-label={label} onKeyDown={onKeyDown} style={{ display: 'flex', flexDirection: 'column', gap: '1px', ...style }}>
      {children}
    </div>
  );
}

// icon: a Lucide component. color: palette name — shows a soft IconTile
// instead of a plain glyph. value: trailing text; badge: trailing count.
export function MenuItem({ icon, color, label, value, badge, destructive, disabled, onClick, ...rest }) {
  const { hovered, pressed, handlers } = useInteraction(disabled);
  const textColor = destructive ? c.redText : c.label;
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      {...rest}
      {...mergeHandlers(handlers, rest)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        minHeight: theme.control.md,
        padding: '5px 8px',
        boxSizing: 'border-box',
        border: 'none',
        borderRadius: theme.radius.sm,
        backgroundColor: pressed ? c.fillStrong : hovered ? c.fill : 'transparent',
        color: textColor,
        fontFamily: theme.font.family,
        ...theme.type.body,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      {icon && color ? (
        <IconTile icon={icon} color={destructive ? 'red' : color} size="sm" variant="soft" />
      ) : (
        icon && <Icon icon={icon} size={18} style={{ color: destructive ? c.redText : c.labelSecondary }} />
      )}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {value != null && <span style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary, whiteSpace: 'nowrap' }}>{value}</span>}
      {badge != null && badge}
    </button>
  );
}

export function MenuDivider() {
  return <div role="separator" style={{ height: '1px', margin: '5px 8px', backgroundColor: c.separator }} />;
}

// Small uppercase heading inside a menu or result list.
export function MenuHeader({ children }) {
  return (
    <div
      style={{
        ...theme.type.caption,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: c.labelSecondary,
        padding: '8px 8px 4px',
      }}
    >
      {children}
    </div>
  );
}
