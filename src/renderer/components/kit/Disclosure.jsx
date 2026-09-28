import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import theme from '../../config/theme';
import useInteraction from './useInteraction';
import { Icon } from './Icon';

const c = theme.colors;

// Collapsible Card section. Uncontrolled with `defaultOpen`, or controlled
// with `open` + `onOpenChange`. `summary` shows next to the title only while
// collapsed, so a closed section still says what's inside.
export function Disclosure({ title, summary, defaultOpen = false, open, onOpenChange, children, style }) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : ownOpen;
  const bodyId = useId();
  const { hovered, handlers } = useInteraction(false);

  function toggle() {
    if (!isControlled) setOwnOpen(!isOpen);
    onOpenChange?.(!isOpen);
  }

  return (
    <section
      style={{
        backgroundColor: c.surface,
        border: `1px solid ${c.separator}`,
        borderRadius: theme.radius.lg,
        fontFamily: theme.font.family,
        overflow: 'hidden',
        ...style,
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={toggle}
        {...handlers}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.smd,
          width: '100%',
          minHeight: '52px',
          padding: `0 ${theme.spacing.md}`,
          border: 'none',
          backgroundColor: hovered ? c.surfaceAlt : 'transparent',
          color: c.label,
          fontFamily: theme.font.family,
          textAlign: 'left',
          cursor: 'pointer',
          transition: `background-color ${theme.motion.fast} ease`,
        }}
      >
        <span style={{ ...theme.type.headline, flexShrink: 0 }}>{title}</span>
        <span
          style={{
            ...theme.type.subhead,
            color: c.labelSecondary,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
            opacity: isOpen ? 0 : 1,
            transition: `opacity ${theme.motion.fast} ease`,
          }}
        >
          {summary}
        </span>
        <Icon
          icon={ChevronDown}
          size={18}
          style={{
            color: c.labelTertiary,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: `transform ${theme.motion.base} ${theme.motion.easing}`,
          }}
        />
      </button>
      {isOpen && (
        <div id={bodyId} style={{ padding: `0 ${theme.spacing.md} ${theme.spacing.md}`, animation: `fade-in ${theme.motion.base} ease` }}>
          {children}
        </div>
      )}
    </section>
  );
}
