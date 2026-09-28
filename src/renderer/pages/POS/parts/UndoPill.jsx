import React from 'react';
import theme from '../../../config/theme';
import { Kbd } from '../../../components/ui';
import { c, keepFocus } from './common';

// Floats just above the key-hints bar; Sale.jsx owns its timing.
export default function UndoPill({ label, onUndo }) {
  return (
    <div role="status" aria-live="polite" style={styles.pill}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Removed {label}</span>
      <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={onUndo} style={styles.undo}>
        Undo <Kbd>Ctrl</Kbd>
        <Kbd>Z</Kbd>
      </button>
    </div>
  );
}

const styles = {
  pill: {
    position: 'absolute',
    left: '50%',
    bottom: '56px',
    transform: 'translateX(-50%)',
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    maxWidth: '520px',
    height: '40px',
    padding: '0 8px 0 18px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.pill,
    backgroundColor: c.surface,
    boxShadow: theme.shadow.popover,
    ...theme.type.subhead,
    color: c.label,
    whiteSpace: 'nowrap',
    // fade only: a translate keyframe would fight the centering transform
    animation: `fade-in ${theme.motion.base} ease`,
  },
  undo: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    height: '28px',
    padding: '0 10px',
    border: 'none',
    borderRadius: theme.radius.pill,
    backgroundColor: c.accentTint,
    color: c.accent,
    fontFamily: theme.font.family,
    ...theme.type.subhead,
    fontWeight: theme.font.weightSemibold,
    cursor: 'pointer',
  },
};
