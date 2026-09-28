import React from 'react';
import theme from '../../config/theme';
import useInteraction from './useInteraction';
import { Skeleton } from './Feedback';

const c = theme.colors;

// Plain <tr> with a flat hover tint, for pages that build tables by hand
// with `tableStyles`.
export function Tr({ children, onClick, style }) {
  const { hovered, handlers } = useInteraction(false);
  return (
    <tr
      onClick={onClick}
      {...handlers}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: hovered ? c.surfaceAlt : 'transparent',
        transition: `background-color ${theme.motion.fast} ease`,
        ...style,
      }}
    >
      {children}
    </tr>
  );
}

export const tableStyles = {
  scroll: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', ...theme.type.subhead },
  th: {
    textAlign: 'left',
    color: c.labelSecondary,
    ...theme.type.footnote,
    fontWeight: theme.font.weightSemibold,
    padding: '8px 14px',
    borderBottom: `1px solid ${c.separator}`,
    backgroundColor: c.surfaceAlt,
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px 14px',
    color: c.label,
    borderBottom: `1px solid ${c.separator}`,
  },
  emptyState: { color: c.labelSecondary, padding: '32px 20px', textAlign: 'center', ...theme.type.body },
};

// columns: [{ key, label, align, width, numeric, render(row) }]
// numeric columns are right-aligned with tabular numerals.
export function DataTable({ columns, rows = [], rowKey = 'id', onRowClick, dense = false, loading = false, emptyState, maxHeight, style }) {
  const pad = dense ? '7px 14px' : '11px 14px';

  const th = (col) => ({
    ...tableStyles.th,
    position: 'sticky',
    top: 0,
    zIndex: 1,
    width: col.width,
    textAlign: col.align || (col.numeric ? 'right' : 'left'),
  });
  const td = (col) => ({
    padding: pad,
    color: c.label,
    borderBottom: `1px solid ${c.separator}`,
    textAlign: col.align || (col.numeric ? 'right' : 'left'),
    ...(col.numeric ? theme.font.numeric : null),
    whiteSpace: col.numeric ? 'nowrap' : undefined,
  });

  let body;
  if (loading) {
    body = Array.from({ length: 5 }, (_, i) => (
      <tr key={`sk-${i}`}>
        {columns.map((col) => (
          <td key={col.key} style={td(col)}>
            <Skeleton width={col.numeric ? '60px' : '70%'} style={col.numeric ? { marginLeft: 'auto' } : undefined} />
          </td>
        ))}
      </tr>
    ));
  } else if (!rows.length) {
    body = (
      <tr>
        <td colSpan={columns.length} style={{ padding: 0 }}>
          {emptyState || <div style={tableStyles.emptyState}>Nothing to show yet.</div>}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row, i) => (
      <DataRow key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}>
        {columns.map((col) => (
          <td key={col.key} style={td(col)}>
            {col.render ? col.render(row) : row[col.key]}
          </td>
        ))}
      </DataRow>
    ));
  }

  return (
    <div style={{ overflow: 'auto', maxHeight, ...style }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" style={th(col)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

function DataRow({ children, onClick }) {
  const { hovered, handlers } = useInteraction(!onClick);
  return (
    <tr
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      {...handlers}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: hovered ? c.surfaceAlt : 'transparent',
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      {children}
    </tr>
  );
}
