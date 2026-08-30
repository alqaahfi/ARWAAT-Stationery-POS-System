import React from 'react';
import theme from '../../../config/theme';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom Range' },
];

function toIso(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Pure — resolves a preset key into concrete { dateFrom, dateTo } ISO date
// strings, anchored to "now" at call time.
export function computeRange(preset) {
  const today = startOfDay(new Date());

  switch (preset) {
    case 'today':
      return { dateFrom: toIso(today), dateTo: toIso(today) };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { dateFrom: toIso(y), dateTo: toIso(y) };
    }
    case 'this_week': {
      const start = new Date(today);
      start.setDate(start.getDate() - today.getDay());
      return { dateFrom: toIso(start), dateTo: toIso(today) };
    }
    case 'this_month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { dateFrom: toIso(start), dateTo: toIso(today) };
    }
    case 'last_month': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { dateFrom: toIso(start), dateTo: toIso(end) };
    }
    case 'this_year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { dateFrom: toIso(start), dateTo: toIso(today) };
    }
    default:
      return { dateFrom: toIso(today), dateTo: toIso(today) };
  }
}

// Every report page's default state — "This Month" is a sensible landing view.
export function getDefaultRange() {
  return { preset: 'this_month', ...computeRange('this_month') };
}

// Controlled — takes { preset, dateFrom, dateTo } and calls onChange with the
// same shape. Doesn't fetch or own any report data itself.
export default function DateRangePicker({ value, onChange }) {
  function selectPreset(key) {
    if (key === 'custom') {
      onChange({ preset: 'custom', dateFrom: value.dateFrom, dateTo: value.dateTo });
      return;
    }
    onChange({ preset: key, ...computeRange(key) });
  }

  return (
    <div>
      <div style={styles.presetRow}>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            style={{ ...styles.presetBtn, ...(value.preset === p.key ? styles.presetBtnActive : {}) }}
            onClick={() => selectPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.preset === 'custom' && (
        <div style={styles.customRow}>
          <input
            type="date"
            value={value.dateFrom}
            onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
            style={styles.dateInput}
          />
          <span style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>to</span>
          <input
            type="date"
            value={value.dateTo}
            onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
            style={styles.dateInput}
          />
        </div>
      )}
    </div>
  );
}

const styles = {
  presetRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  presetBtn: {
    padding: '7px 12px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeSm,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },
  presetBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
    color: theme.colors.primaryText,
  },
  customRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: theme.spacing.sm },
  dateInput: {
    padding: '7px 10px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.font.sizeSm,
    fontFamily: theme.font.family,
    color: theme.colors.textPrimary,
  },
};
