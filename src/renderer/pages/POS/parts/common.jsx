import React from 'react';
import { CircleAlert, CircleCheck, Info, Search, TriangleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import { Icon, TextInput } from '../../../components/ui';

export const c = theme.colors;

// Cashier Mode is the all-day working screen, so its entry controls run
// larger than the rest of the app.
export const BIG_INPUT = { height: '48px', fontSize: '18px', borderRadius: theme.radius.md };
export const NUMERIC_INPUT = { ...BIG_INPUT, ...theme.font.numeric, textAlign: 'right' };

// Mouse clicks inside the entry area must not steal focus from the active
// input — Sale.jsx's one keydown handler (and typing) keeps working.
export function keepFocus(e) {
  e.preventDefault();
}

export function typeName(variantName) {
  return variantName && variantName !== 'Standard' ? variantName : null;
}

export function packSizeName(item) {
  return item.units.find((u) => u.id === item.unitId)?.unitName || item.baseUnitName;
}

export function PanelTitle({ title, hint }) {
  return (
    <div style={{ marginBottom: theme.spacing.smd }}>
      <div style={{ ...theme.type.title2, color: c.label }}>{title}</div>
      {hint && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{hint}</div>}
    </div>
  );
}

const TONES = {
  error: { color: 'red', icon: CircleAlert },
  warning: { color: 'orange', icon: TriangleAlert },
  info: { color: 'blue', icon: Info },
  success: { color: 'green', icon: CircleCheck },
};

// Errors and warnings interrupt (role="alert"); notes are announced politely.
export function InlineMessage({ tone = 'error', children, style }) {
  if (!children) return null;
  const t = TONES[tone];
  const urgent = tone === 'error' || tone === 'warning';
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? undefined : 'polite'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        marginTop: theme.spacing.sm,
        padding: '8px 12px',
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

// Large combobox-style search box. Plain input on purpose (not the kit
// SearchField): that one swallows Esc, and Esc belongs to Sale.jsx here.
export function BigSearchInput({ inputRef, value, onChange, placeholder, label, listId, activeId, expanded, disabled }) {
  return (
    <div style={{ position: 'relative' }}>
      <Icon
        icon={Search}
        size={20}
        style={{ position: 'absolute', left: '14px', top: '50%', marginTop: '-10px', color: c.labelSecondary, pointerEvents: 'none' }}
      />
      <TextInput
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-expanded={!!expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && activeId ? activeId : undefined}
        style={{ ...BIG_INPUT, paddingLeft: '44px' }}
      />
    </div>
  );
}

// Dimmed backdrop for the POS overlays. Deliberately not the kit Modal:
// that installs its own key handling, and Sale.jsx must keep owning keys.
export function Scrim({ children, labelledBy, role = 'dialog' }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: c.scrim, animation: `fade-in ${theme.motion.base} ease` }}>
      <div role={role} aria-modal="true" aria-labelledby={labelledBy} style={{ animation: `pop-in ${theme.motion.base} ${theme.motion.easing}`, maxWidth: '100%', maxHeight: '100%', display: 'flex' }}>
        {children}
      </div>
    </div>
  );
}

export function Money({ value, style }) {
  return <span style={{ ...theme.font.numeric, whiteSpace: 'nowrap', ...style }}>{value}</span>;
}
