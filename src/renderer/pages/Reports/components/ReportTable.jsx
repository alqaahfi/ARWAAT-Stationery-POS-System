import React, { memo, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import theme from '../../../config/theme';
import { Icon, tableStyles } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';
import { formatCell } from '../utils/formatCell';

const c = theme.colors;
const RIGHT_ALIGNED = new Set(['currency', 'number']);

// Generic sortable table driven by a report's `columns` definition, in the
// kit DataTable look (sticky header, tabular numbers right-aligned).
// A column may add `render(row)` for a richer cell (badge, avatar…); sorting
// still uses the raw row[key]. `totals` (optional) is a row object shown as a
// semibold totals row at the bottom.
export default function ReportTable({ columns, rows, onRowClick, totals, maxHeight = '560px', emptyText = 'No data for the selected filters.' }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sortedRows = useMemo(
    () =>
      sortKey
        ? [...rows].sort((a, b) => {
            const av = a[sortKey];
            const bv = b[sortKey];
            if (av === bv) return 0;
            const result = av > bv ? 1 : -1;
            return sortDir === 'asc' ? result : -result;
          })
        : rows,
    [rows, sortKey, sortDir]
  );

  const align = (col) => (RIGHT_ALIGNED.has(col.format) ? 'right' : 'left');

  return (
    <div style={{ overflow: 'auto', maxHeight }}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {columns.map((col) => {
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  style={{ ...tableStyles.th, ...styles.th, textAlign: align(col) }}
                >
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    style={{ ...styles.sortButton, justifyContent: align(col) === 'right' ? 'flex-end' : 'flex-start', color: active ? c.label : c.labelSecondary }}
                  >
                    {col.label}
                    {active && <Icon icon={sortDir === 'asc' ? ChevronUp : ChevronDown} size={16} />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <ReportRow key={row.id ?? i} row={row} columns={columns} onRowClick={onRowClick} />
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={tableStyles.emptyState}>
                {emptyText}
              </td>
            </tr>
          )}
        </tbody>
        {totals && sortedRows.length > 0 && (
          <tfoot>
            <tr>
              {columns.map((col, i) => (
                <td key={col.key} style={{ ...styles.td, ...styles.totalCell, textAlign: align(col), ...(RIGHT_ALIGNED.has(col.format) ? styles.numeric : null) }}>
                  {totals[col.key] !== undefined ? formatCell(totals[col.key], col.format) : i === 0 ? 'Total' : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

const ReportRow = memo(function ReportRow({ row, columns, onRowClick }) {
  const clickable = !!onRowClick;
  const { hovered, handlers } = useInteraction(!clickable);
  return (
    <tr
      onClick={clickable ? () => onRowClick(row) : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onRowClick(row);
              }
            }
          : undefined
      }
      {...handlers}
      style={{
        cursor: clickable ? 'pointer' : 'default',
        backgroundColor: hovered ? c.surfaceAlt : 'transparent',
        transition: `background-color ${theme.motion.fast} ease`,
        outlineOffset: '-3px',
      }}
    >
      {columns.map((col) => {
        const numeric = RIGHT_ALIGNED.has(col.format);
        return (
          <td key={col.key} style={{ ...styles.td, textAlign: numeric ? 'right' : 'left', ...(numeric ? styles.numeric : null) }}>
            {col.render ? col.render(row) : formatCell(row[col.key], col.format)}
          </td>
        );
      })}
    </tr>
  );
});

const styles = {
  th: { position: 'sticky', top: 0, zIndex: 1, padding: 0 },
  sortButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    width: '100%',
    padding: '8px 14px',
    border: 'none',
    background: 'transparent',
    font: 'inherit',
    fontWeight: theme.font.weightSemibold,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    outlineOffset: '-3px',
  },
  td: { padding: '11px 14px', color: c.label, borderBottom: `1px solid ${c.separator}`, verticalAlign: 'middle' },
  numeric: { ...theme.font.numeric, whiteSpace: 'nowrap' },
  totalCell: {
    position: 'sticky',
    bottom: 0,
    fontWeight: theme.font.weightSemibold,
    backgroundColor: c.surface,
    borderTop: `1px solid ${c.separatorStrong}`,
    borderBottom: 'none',
  },
};
