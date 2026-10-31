import React from 'react';
import { Ban, FileText, ReceiptText } from 'lucide-react';
import theme from '../../../config/theme';
import { IconTile, Kbd } from '../../../components/ui';
import { PanelTitle, c, keepFocus } from './common';

const OPTIONS = [
  { value: 'wholesale-a4', key: '1', icon: FileText, color: 'blue', title: 'A4 invoice', note: 'For wholesale customers' },
  { value: 'retail-thermal', key: '2', icon: ReceiptText, color: 'orange', title: 'Small receipt', note: 'Thermal printer, for retail customers' },
  { value: 'none', key: '3', icon: Ban, color: 'gray', title: 'No Receipt', note: 'Save sale without printing' },
];

export default function FormatPanel({ value, onChoose }) {
  return (
    <>
      <PanelTitle title="How would you like to print the receipt?" hint="Press 1, 2 or 3 (or ← →) to choose, then Enter." />
      <div role="radiogroup" aria-label="Receipt type" style={styles.grid} onMouseDown={keepFocus}>
        {OPTIONS.map((o) => {
          const selected = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={-1}
              onClick={() => onChoose(o.value)}
              style={{
                ...styles.card,
                borderColor: selected ? c.accent : c.separator,
                backgroundColor: selected ? c.accentTint : c.surface,
              }}
            >
              <IconTile icon={o.icon} color={o.color} size="lg" variant="soft" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ ...theme.type.headline, color: c.label, display: 'block' }}>{o.title}</span>
                <span style={{ ...theme.type.subhead, color: c.labelSecondary, display: 'block' }}>{o.note}</span>
              </span>
              <Kbd>{o.key}</Kbd>
            </button>
          );
        })}
      </div>
    </>
  );
}

const styles = {
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: theme.spacing.smd },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    minHeight: '76px',
    padding: '12px 16px',
    textAlign: 'left',
    border: '2px solid',
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.family,
    cursor: 'pointer',
    transition: `background-color ${theme.motion.fast} ease, border-color ${theme.motion.fast} ease`,
  },
};
