import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import theme from '../../config/theme';
import { IconButton } from '../ui';

const c = theme.colors;

// Large in-place sheet that sits over whatever page opened it, so a bill can be
// made without leaving that page. Esc / the X ask `onRequestClose` (the form
// decides whether to confirm first). Esc is ignored while a dialog or sheet
// opened on top of this one is showing, so it only closes the top layer.
export default function BillOverlay({ title, subtitle, onRequestClose, children }) {
  const rootRef = useRef(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    const previous = document.activeElement;
    function onKey(e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const dialogs = [...document.querySelectorAll('[aria-modal="true"]')];
      const topmost = dialogs[dialogs.length - 1];
      if (topmost && topmost !== rootRef.current) return;
      e.preventDefault();
      closeRef.current?.();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return createPortal(
    <div style={styles.scrim}>
      <div ref={rootRef} role="dialog" aria-modal="true" aria-label={title} style={styles.sheet}>
        <header style={styles.header}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ ...theme.type.title2, color: c.label, margin: 0 }}>{title}</h2>
            {subtitle && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{subtitle}</div>}
          </div>
          <IconButton icon={X} label="Close (Esc)" onClick={() => closeRef.current?.()} />
        </header>
        <div style={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  scrim: {
    position: 'fixed',
    inset: 0,
    zIndex: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: c.scrim,
    animation: `fade-in ${theme.motion.base} ease`,
  },
  sheet: {
    width: '1180px',
    maxWidth: '100%',
    height: '100%',
    maxHeight: '860px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: c.bg,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
    overflow: 'hidden',
    fontFamily: theme.font.family,
    color: c.label,
    animation: `pop-in ${theme.motion.base} ${theme.motion.easing}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.smd} ${theme.spacing.md} ${theme.spacing.smd} ${theme.spacing.mdl}`,
    backgroundColor: c.surface,
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: theme.spacing.md },
};
