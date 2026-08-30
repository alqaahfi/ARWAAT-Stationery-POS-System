import React, { useState } from 'react';
import { tableStyles, Tr } from '../../../components/ui';
import { formatCell } from '../utils/formatCell';

const RIGHT_ALIGNED = new Set(['currency', 'number']);

// Generic sortable table driven entirely by a report's `columns` definition —
// every report page reuses this instead of hand-rolling its own <table>.
export default function ReportTable({ columns, rows, onRowClick }) {
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

  const sortedRows = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === bv) return 0;
        const result = av > bv ? 1 : -1;
        return sortDir === 'asc' ? result : -result;
      })
    : rows;

  return (
    <div style={tableStyles.scroll}>
      <table style={tableStyles.table}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{ ...tableStyles.th, cursor: 'pointer', userSelect: 'none', textAlign: RIGHT_ALIGNED.has(c.format) ? 'right' : 'left' }}
                onClick={() => handleSort(c.key)}
              >
                {c.label}
                {sortKey === c.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <Tr key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}>
              {columns.map((c) => (
                <td key={c.key} style={{ ...tableStyles.td, textAlign: RIGHT_ALIGNED.has(c.format) ? 'right' : 'left' }}>
                  {formatCell(row[c.key], c.format)}
                </td>
              ))}
            </Tr>
          ))}
          {sortedRows.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={tableStyles.emptyState}>
                No data for the selected filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
