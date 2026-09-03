// src/renderer/components/DevPanel/shared.jsx
//
// Small utilitarian building blocks shared by the Dev Panel's tabs — kept
// local to this folder since they're deliberately styled differently
// (denser, monospace) from the rest of the app's src/renderer/components/ui.jsx.
import React from 'react';
import theme from './devPanelTheme';

export function PanelInput({ style, ...props }) {
  return (
    <input
      {...props}
      style={{
        padding: '6px 8px',
        borderRadius: theme.radius.sm,
        border: `1px solid ${theme.colors.panelBorder}`,
        backgroundColor: theme.colors.panelBackgroundAlt,
        color: theme.colors.panelText,
        fontSize: theme.font.sizeSm,
        fontFamily: theme.font.mono,
        outline: 'none',
        ...style,
      }}
    />
  );
}

export function PanelSelect({ style, children, ...props }) {
  return (
    <select
      {...props}
      style={{
        padding: '6px 8px',
        borderRadius: theme.radius.sm,
        border: `1px solid ${theme.colors.panelBorder}`,
        backgroundColor: theme.colors.panelBackgroundAlt,
        color: theme.colors.panelText,
        fontSize: theme.font.sizeSm,
        fontFamily: theme.font.mono,
        outline: 'none',
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export function PanelButton({ children, onClick, disabled, variant = 'default', style }) {
  const variants = {
    default: { backgroundColor: theme.colors.panelBackgroundAlt, color: theme.colors.panelText, border: `1px solid ${theme.colors.panelBorder}` },
    primary: { backgroundColor: theme.colors.primary, color: theme.colors.primaryText, border: '1px solid transparent' },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        borderRadius: theme.radius.sm,
        fontSize: theme.font.sizeSm,
        fontFamily: theme.font.mono,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function PaginationBar({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.sm, fontFamily: theme.font.mono, fontSize: theme.font.sizeXs, color: theme.colors.panelTextSecondary }}>
      <PanelButton disabled={page <= 1} onClick={() => onPageChange(page - 1)}>{'< prev'}</PanelButton>
      <span>page {page} / {totalPages} — {total} row{total === 1 ? '' : 's'}</span>
      <PanelButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>{'next >'}</PanelButton>
    </div>
  );
}

export function DataTable({ columns, rows, emptyLabel = 'No rows.' }) {
  if (!rows.length) {
    return <div style={{ color: theme.colors.panelTextSecondary, fontFamily: theme.font.mono, fontSize: theme.font.sizeSm, padding: theme.spacing.md }}>{emptyLabel}</div>;
  }
  const cols = columns || Object.keys(rows[0]);
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${theme.colors.panelBorder}`, borderRadius: theme.radius.sm }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: theme.font.mono, fontSize: theme.font.sizeXs }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: `1px solid ${theme.colors.panelBorder}`, backgroundColor: theme.colors.panelBackgroundAlt, color: theme.colors.panelTextSecondary, whiteSpace: 'nowrap' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {cols.map((c) => (
                <td key={c} style={{ padding: '6px 10px', borderBottom: `1px solid ${theme.colors.panelBorder}`, color: theme.colors.panelText, whiteSpace: 'nowrap', maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value) {
  if (value === null || value === undefined) return <span style={{ opacity: 0.4 }}>null</span>;
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
