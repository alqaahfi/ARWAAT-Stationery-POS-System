import React, { useEffect, useId, useState } from 'react';
import { Calendar, Check, ChevronDown } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, Icon, Label, Menu, MenuDivider, MenuItem, Popover, TextInput } from '../../../components/ui';

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

function parseIso(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number);
  return y ? new Date(y, (m || 1) - 1, d || 1) : null;
}

// "1 Sep – 28 Sep" (years added only when they differ from this year / each other).
export function formatRangeText(dateFrom, dateTo) {
  const a = parseIso(dateFrom);
  const b = parseIso(dateTo);
  if (!a || !b) return 'Pick dates';
  const thisYear = new Date().getFullYear();
  const needYear = a.getFullYear() !== b.getFullYear() || b.getFullYear() !== thisYear;
  const fmt = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(needYear ? { year: 'numeric' } : null) });
  return dateFrom === dateTo ? fmt(a) : `${fmt(a)} – ${fmt(b)}`;
}

// Controlled — takes { preset, dateFrom, dateTo } and calls onChange with the
// same shape. Doesn't fetch or own any report data itself. Renders a compact
// button ("This Month · 1 Sep – 28 Sep") that opens the presets + Custom.
export default function DateRangePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const idBase = useId();
  const [draft, setDraft] = useState({ dateFrom: value.dateFrom, dateTo: value.dateTo });

  useEffect(() => {
    if (open) {
      setDraft({ dateFrom: value.dateFrom, dateTo: value.dateTo });
      setCustomOpen(value.preset === 'custom');
    }
  }, [open, value.preset, value.dateFrom, value.dateTo]);

  const current = PRESETS.find((p) => p.key === value.preset);
  const rangeText = formatRangeText(value.dateFrom, value.dateTo);
  const buttonText = value.preset && value.preset !== 'custom' && current ? `${current.label} · ${rangeText}` : rangeText;

  function selectPreset(key, close) {
    onChange({ preset: key, ...computeRange(key) });
    close();
  }

  const draftValid = draft.dateFrom && draft.dateTo && draft.dateFrom <= draft.dateTo;

  function applyCustom(close) {
    if (!draftValid) return;
    onChange({ preset: 'custom', dateFrom: draft.dateFrom, dateTo: draft.dateTo });
    close();
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="start"
      width={280}
      anchor={
        <Button
          variant="secondary"
          icon={Calendar}
          iconRight={ChevronDown}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Date range: ${buttonText}`}
          onClick={() => setOpen((o) => !o)}
        >
          {buttonText}
        </Button>
      }
    >
      {(close) => (
        <>
          <Menu label="Date range" autoFocus={!customOpen}>
            {PRESETS.filter((p) => p.key !== 'custom').map((p) => (
              <MenuItem
                key={p.key}
                label={p.label}
                value={formatRangeText(computeRange(p.key).dateFrom, computeRange(p.key).dateTo)}
                badge={value.preset === p.key ? <Icon icon={Check} size={16} style={{ color: theme.colors.accent }} /> : null}
                onClick={() => selectPreset(p.key, close)}
              />
            ))}
            <MenuDivider />
            <MenuItem
              label="Custom Range"
              badge={value.preset === 'custom' ? <Icon icon={Check} size={16} style={{ color: theme.colors.accent }} /> : null}
              aria-expanded={customOpen}
              onClick={() => setCustomOpen((v) => !v)}
            />
          </Menu>
          {customOpen && (
            <form
              style={styles.custom}
              onSubmit={(e) => {
                e.preventDefault();
                applyCustom(close);
              }}
            >
              <div style={styles.customRow}>
                <div style={{ flex: 1 }}>
                  <Label htmlFor={`${idBase}-from`} style={styles.label}>
                    From
                  </Label>
                  <TextInput
                    id={`${idBase}-from`}
                    type="date"
                    autoFocus
                    value={draft.dateFrom}
                    max={draft.dateTo || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Label htmlFor={`${idBase}-to`} style={styles.label}>
                    To
                  </Label>
                  <TextInput
                    id={`${idBase}-to`}
                    type="date"
                    value={draft.dateTo}
                    min={draft.dateFrom || undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
                  />
                </div>
              </div>
              <Button type="submit" size="sm" fullWidth disabled={!draftValid} style={{ marginTop: theme.spacing.sm }}>
                Apply
              </Button>
            </form>
          )}
        </>
      )}
    </Popover>
  );
}

const styles = {
  custom: { padding: '8px 8px 4px' },
  customRow: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  label: { marginTop: 0, marginBottom: '4px' },
};
