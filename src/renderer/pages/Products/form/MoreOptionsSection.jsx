import React, { useId } from 'react';
import theme from '../../../config/theme';
import { Disclosure, Field, Textarea, Toggle } from '../../../components/ui';

const c = theme.colors;

// Section 6 — rarely-changed settings, collapsed.
export function MoreOptionsSection({ isEdit, notes, onNotesChange, isActive, onIsActiveChange }) {
  return (
    <Disclosure title="More options" summary={isEdit && !isActive ? 'Inactive' : undefined}>
      {isEdit && <OptionRow label="Active" hint="Inactive items are hidden from sales." checked={isActive} onChange={onIsActiveChange} />}
      <Field label="Notes" style={{ marginTop: theme.spacing.md, marginBottom: 0 }}>
        <Textarea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Anything worth remembering about this item" rows={3} />
      </Field>
    </Disclosure>
  );
}

function OptionRow({ label, hint, checked, onChange }) {
  const id = useId();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${c.separator}` }}>
      <div style={{ flex: 1 }}>
        <label htmlFor={id} style={{ ...theme.type.body, color: c.label, cursor: 'pointer' }}>
          {label}
        </label>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{hint}</div>
      </div>
      <Toggle id={id} checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
