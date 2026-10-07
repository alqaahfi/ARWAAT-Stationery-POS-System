import React from 'react';
import theme from '../../../config/theme';

const c = theme.colors;

// Alternative Urdu spellings for each word of the name. `words` is
// [[option, ...], ...] (one list per space-separated word). Clicking an option
// swaps that word in `name`. Hidden once the name no longer has the same
// number of words, so a swap can never land on the wrong word.
export default function UrduSuggestions({ words, name, onPick }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!words || words.length === 0 || parts.length !== words.length) return null;
  const rows = words.map((options, i) => ({ options: options.slice(0, 8), i })).filter((r) => r.options.length > 1);
  if (rows.length === 0) return null;
  return (
    <div style={{ marginTop: theme.spacing.xs }}>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginBottom: '4px' }}>Wrong word? Tap the right spelling:</div>
      {rows.map(({ options, i }) => (
        <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
          {options.map((opt) => {
            const active = parts[i] === opt;
            return (
              <button
                key={opt}
                type="button"
                dir="rtl"
                onClick={() => {
                  const next = [...parts];
                  next[i] = opt;
                  onPick(next.join(' '));
                }}
                style={{
                  border: `1px solid ${active ? c.accent : c.separatorStrong}`,
                  backgroundColor: active ? c.accentTint : c.surface,
                  color: active ? c.accent : c.label,
                  borderRadius: theme.radius.sm,
                  padding: '2px 10px',
                  cursor: 'pointer',
                  fontFamily: theme.font.family,
                  ...theme.type.body,
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
