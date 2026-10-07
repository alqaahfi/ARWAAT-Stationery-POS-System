import React, { useState } from 'react';
import theme from '../../../config/theme';
import { c, keepFocus } from './common';

// Large three-dimensional action button for the sale screen. The shortcut key
// is printed on the button face so the cashier never has to guess it.
const TONES = {
  neutral: { face: c.surface, edge: c.separatorStrong, text: c.label, keyBg: c.fill, keyText: c.labelSecondary },
  blue: { face: c.accent, edge: c.accentPressed, text: c.labelOnAccent, keyBg: c.surface, keyText: c.accent },
  red: { face: c.red, edge: c.redPressed, text: c.labelOnAccent, keyBg: c.surface, keyText: c.redText },
  orange: { face: c.orangeTint, edge: c.orange, text: c.orangeText, keyBg: c.surface, keyText: c.orangeText },
  green: { face: c.greenTint, edge: c.green, text: c.greenText, keyBg: c.surface, keyText: c.greenText },
};

const DEPTH = 4;

export default function PosButton({ label, shortcut, tone = 'neutral', icon: IconCmp, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const t = TONES[tone] || TONES.neutral;
  const lift = pressed ? DEPTH : hovered ? -1 : 0;
  return (
    <button
      type="button"
      tabIndex={-1}
      disabled={disabled}
      onMouseDown={(e) => {
        keepFocus(e);
        setPressed(true);
      }}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onClick={onClick}
      style={{
        ...styles.btn,
        backgroundColor: t.face,
        color: t.text,
        border: `1px solid ${t.edge}`,
        boxShadow: pressed ? `0 0 0 ${t.edge}` : `0 ${DEPTH}px 0 ${t.edge}`,
        transform: `translateY(${lift}px)`,
        marginBottom: DEPTH,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {IconCmp && <IconCmp size={18} aria-hidden="true" />}
      <span>{label}</span>
      {shortcut && <span style={{ ...styles.key, backgroundColor: t.keyBg, color: t.keyText }}>{shortcut}</span>}
    </button>
  );
}

const styles = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '44px',
    padding: '0 16px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.md,
    fontFamily: theme.font.family,
    fontSize: theme.type.headline.fontSize,
    fontWeight: theme.font.weightSemibold,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    transition: `transform ${theme.motion.fast} ease, box-shadow ${theme.motion.fast} ease`,
  },
  key: {
    padding: '3px 7px',
    borderRadius: theme.radius.sm,
    fontSize: theme.type.footnote.fontSize,
    fontWeight: theme.font.weightBold,
    letterSpacing: '0.02em',
  },
};
