import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import theme from '../../config/theme';
import { Icon, IconTile } from './Icon';

const c = theme.colors;
const canBlur = typeof CSS !== 'undefined' && CSS.supports?.('backdrop-filter', 'blur(1px)');
// Translucent "material" where blur is supported, plain surface otherwise.
const material = canBlur
  ? { backgroundColor: c.material, backdropFilter: 'saturate(180%) blur(20px)' }
  : { backgroundColor: c.surface };

// --- Loading -------------------------------------------------------------

export function Spinner({ size = 18, style }) {
  return (
    <span
      data-ui-spinner=""
      role="progressbar"
      aria-label="Loading"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: theme.radius.pill,
        border: `2px solid ${c.fillStrong}`,
        borderTopColor: 'currentColor',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// Shimmering placeholder. lines > 1 renders a paragraph-like stack.
export function Skeleton({ width = '100%', height = '14px', radius = theme.radius.xs, lines = 1, style }) {
  if (lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', ...style }}>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height={height} radius={radius} width={i === lines - 1 ? '60%' : width} />
        ))}
      </div>
    );
  }
  return (
    <div aria-hidden="true" style={{ position: 'relative', overflow: 'hidden', width, height, borderRadius: radius, backgroundColor: c.fill, ...style }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(90deg, transparent, ${c.shimmer}, transparent)`,
          animation: 'shimmer 1.4s ease-in-out infinite',
        }}
      />
    </div>
  );
}

// --- Empty state --------------------------------------------------------

export function EmptyState({ icon, color = 'gray', title, message, action, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '40px 24px', ...style }}>
      {icon && <IconTile icon={icon} color={color} size="xl" variant="soft" />}
      {title && <div style={{ ...theme.type.headline, color: c.label, marginTop: theme.spacing.smd }}>{title}</div>}
      {message && (
        <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '4px', maxWidth: '360px' }}>{message}</div>
      )}
      {action && <div style={{ marginTop: theme.spacing.md }}>{action}</div>}
    </div>
  );
}

// --- Toasts -------------------------------------------------------------

const ToastContext = createContext(null);
const TOAST_TYPES = {
  success: { icon: CircleCheck, color: c.green, ms: 3000 },
  error: { icon: CircleAlert, color: c.red, ms: 5000 },
  info: { icon: Info, color: c.accent, ms: 3000 },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (type, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_TYPES[type].ms);
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m) => show('success', m),
      error: (m) => show('error', m),
      info: (m) => show('info', m),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => {
            const kind = TOAST_TYPES[t.type];
            return (
              <div
                key={t.id}
                role="status"
                title="Click to dismiss"
                onClick={() => dismiss(t.id)}
                style={{
                  ...material,
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  minWidth: '240px',
                  maxWidth: '480px',
                  padding: '10px 16px',
                  borderRadius: theme.radius.lg,
                  boxShadow: theme.shadow.popover,
                  color: c.label,
                  fontFamily: theme.font.family,
                  ...theme.type.body,
                  fontWeight: theme.font.weightMedium,
                  cursor: 'pointer',
                  animation: `slide-down ${theme.motion.base} ${theme.motion.easing}`,
                }}
              >
                <Icon icon={kind.icon} size={20} style={{ color: kind.color }} />
                <span>{t.message}</span>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

const noopToast = { success: () => {}, error: () => {}, info: () => {} };
export function useToast() {
  return useContext(ToastContext) || noopToast;
}

// --- Overlay (shared by Modal and Confirm) ------------------------------

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function Overlay({ onClose, dismissible = true, zIndex = 1000, labelledBy, role = 'dialog', children, sheetStyle }) {
  const sheetRef = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const node = sheetRef.current;
    if (node && !node.contains(document.activeElement)) {
      (node.querySelector(FOCUSABLE) || node).focus();
    }
    return () => previous?.focus?.();
  }, []);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose?.();
      return;
    }
    if (e.key === 'Tab') {
      const items = [...sheetRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  return createPortal(
    <div
      onKeyDown={onKeyDown}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose?.();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        backgroundColor: c.scrim,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
        animation: `fade-in ${theme.motion.base} ease`,
      }}
    >
      <div
        ref={sheetRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
          fontFamily: theme.font.family,
          color: c.label,
          boxShadow: theme.shadow.modal,
          animation: `pop-in ${theme.motion.base} ${theme.motion.easing}`,
          ...sheetStyle,
        }}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// --- Modal ----------------------------------------------------------------

export function Modal({ open, onClose, title, subtitle, children, footer, width = 480, dismissible = true }) {
  const titleId = React.useId();
  if (!open) return null;
  return (
    <Overlay
      onClose={onClose}
      dismissible={dismissible}
      labelledBy={title ? titleId : undefined}
      sheetStyle={{ width, maxWidth: '100%', backgroundColor: c.surface, borderRadius: theme.radius.xl, overflow: 'hidden' }}
    >
      {(title || onClose) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: theme.spacing.sm, padding: '18px 20px 0' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title && (
              <h2 id={titleId} style={{ ...theme.type.title2, margin: 0 }}>
                {title}
              </h2>
            )}
            {subtitle && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{subtitle}</div>}
          </div>
          {onClose && dismissible && (
            <button
              type="button"
              aria-label="Close"
              title="Close (Esc)"
              onClick={onClose}
              style={{
                width: '28px',
                height: '28px',
                marginRight: '-4px',
                padding: 0,
                border: 'none',
                borderRadius: theme.radius.pill,
                backgroundColor: c.fill,
                color: c.labelSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={2.25} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <div style={{ padding: '16px 20px 20px', overflowY: 'auto', ...theme.type.body }}>{children}</div>
      {footer && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: theme.spacing.sm,
            padding: '12px 20px',
            borderTop: `1px solid ${c.separator}`,
          }}
        >
          {footer}
        </div>
      )}
    </Overlay>
  );
}

// --- Confirm (iOS-style alert) --------------------------------------------

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null);

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setPending((prev) => {
          prev?.resolve(false);
          return { opts: opts || {}, resolve };
        });
      }),
    []
  );

  function finish(result) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog {...pending.opts} onResult={finish} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  return ctx || ((opts) => Promise.resolve(window.confirm(opts?.message || opts?.title || 'Are you sure?')));
}

function ConfirmDialog({ title = 'Are you sure?', message, confirmLabel = 'OK', cancelLabel = 'Cancel', destructive = false, onResult }) {
  const titleId = React.useId();
  const btn = {
    flex: 1,
    height: '44px',
    border: 'none',
    backgroundColor: 'transparent',
    fontFamily: theme.font.family,
    fontSize: theme.type.headline.fontSize,
    cursor: 'pointer',
  };
  return (
    <Overlay
      role="alertdialog"
      zIndex={1050}
      onClose={() => onResult(false)}
      dismissible={false}
      labelledBy={titleId}
      sheetStyle={{ ...material, width: 320, maxWidth: '100%', borderRadius: theme.radius.lg, overflow: 'hidden' }}
    >
      <div style={{ padding: '20px 18px 16px', textAlign: 'center' }}>
        <div id={titleId} style={{ ...theme.type.headline }}>
          {title}
        </div>
        {message && <div style={{ ...theme.type.subhead, color: c.label, marginTop: '4px' }}>{message}</div>}
      </div>
      <div style={{ display: 'flex', borderTop: `1px solid ${c.separatorStrong}` }}>
        <button
          type="button"
          autoFocus={destructive}
          onClick={() => onResult(false)}
          style={{ ...btn, color: c.accent, fontWeight: destructive ? theme.font.weightSemibold : theme.font.weightNormal }}
        >
          {cancelLabel}
        </button>
        <div style={{ width: '1px', backgroundColor: c.separatorStrong }} />
        <button
          type="button"
          autoFocus={!destructive}
          onClick={() => onResult(true)}
          style={{
            ...btn,
            color: destructive ? c.redText : c.accent,
            fontWeight: destructive ? theme.font.weightNormal : theme.font.weightSemibold,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Overlay>
  );
}
