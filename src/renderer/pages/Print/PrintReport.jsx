import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { REPORT_TITLES } from '../Reports/reportTitles';
import { formatCell } from '../Reports/utils/formatCell';

// Rendered only inside the hidden BrowserWindow that exportReportPdf.js
// (main process) drives — no sidebar, no top bar, no filter controls, no
// chart interactivity. Just a title, the applied date range, summary
// numbers, and a plain data table, ready for printToPDF().
export default function PrintReport({ reportType, filters }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    window.api.reports.getReport({ reportType, filters, requestingUserId: filters?.requestingUserId }).then(setData);
  }, [reportType, filters]);

  const title = REPORT_TITLES[reportType] || 'Report';

  if (!data) {
    return (
      <div style={styles.page}>
        <div style={styles.title}>{title}</div>
        <div style={{ color: theme.colors.textSecondary }}>Loading…</div>
      </div>
    );
  }

  if (!data.success) {
    return (
      <div style={styles.page}>
        <div style={styles.title}>{title}</div>
        <div style={{ color: theme.colors.danger }}>{data.reason || 'Could not load report.'}</div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.title}>{title}</div>
      {(filters?.dateFrom || filters?.dateTo) && (
        <div style={styles.rangeLabel}>
          {filters.dateFrom} to {filters.dateTo}
        </div>
      )}

      {data.limitationNote && <div style={styles.note}>{data.limitationNote}</div>}

      <div style={styles.summaryRow}>
        {data.summary.map((item, i) => (
          <div key={i} style={styles.summaryItem}>
            <div style={styles.summaryLabel}>{item.label}</div>
            <div style={styles.summaryValue}>{formatCell(item.value, item.format)}</div>
          </div>
        ))}
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            {data.columns.map((c) => (
              <th key={c.key} style={styles.th}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={row.id ?? i}>
              {data.columns.map((c) => (
                <td key={c.key} style={styles.td}>
                  {formatCell(row[c.key], c.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Plain black-on-white, print-appropriate — reuses theme.js tokens where they
// still make sense (spacing, font family) but doesn't touch the dark navy
// sidebar palette since there isn't a sidebar on this route.
const styles = {
  page: { backgroundColor: '#ffffff', color: '#111827', fontFamily: theme.font.family, padding: '24px', minHeight: '100vh' },
  title: { fontSize: '22px', fontWeight: theme.font.weightSemibold, marginBottom: '4px' },
  rangeLabel: { color: '#4b5563', fontSize: theme.font.sizeSm, marginBottom: '16px' },
  note: {
    border: '1px solid #d1d5db',
    borderRadius: theme.radius.sm,
    padding: '8px 12px',
    fontSize: theme.font.sizeSm,
    marginBottom: '16px',
    color: '#4b5563',
  },
  summaryRow: { display: 'flex', gap: '24px', marginBottom: '20px', flexWrap: 'wrap' },
  summaryItem: { minWidth: '140px' },
  summaryLabel: { color: '#6b7280', fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  summaryValue: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, marginTop: '2px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.sizeSm },
  th: { textAlign: 'left', padding: '6px 10px', borderBottom: '2px solid #111827', fontWeight: theme.font.weightSemibold },
  td: { padding: '6px 10px', borderBottom: '1px solid #d1d5db' },
};
