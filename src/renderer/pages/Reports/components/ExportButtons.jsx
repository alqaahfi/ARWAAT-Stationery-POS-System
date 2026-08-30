import React, { useState } from 'react';
import theme from '../../../config/theme';
import { Button } from '../../../components/ui';

// rows/columns are the report's *current filtered* data — export reflects
// exactly what's on screen. `reportType` + `filters` are only needed for the
// PDF path (the hidden print window re-fetches its own data by reportType).
export default function ExportButtons({ rows, columns, reportType, filters, suggestedName }) {
  const [busy, setBusy] = useState(null); // null | 'csv' | 'pdf'
  const [message, setMessage] = useState('');

  async function handleCsv() {
    setBusy('csv');
    setMessage('');
    const res = await window.api.reports.exportCsv({ rows, columns, suggestedName: suggestedName || `${reportType}.csv` });
    setBusy(null);
    if (res.canceled) return;
    setMessage(res.success ? 'CSV exported.' : res.reason || 'Could not export CSV.');
  }

  async function handlePdf() {
    setBusy('pdf');
    setMessage('');
    const res = await window.api.reports.exportPdf({ reportType, filters });
    setBusy(null);
    if (res.canceled) return;
    setMessage(res.success ? 'PDF exported.' : res.reason || 'Could not export PDF.');
  }

  return (
    <div style={styles.container}>
      <Button variant="secondary" onClick={handleCsv} disabled={busy !== null}>
        {busy === 'csv' ? 'Exporting…' : 'Export CSV'}
      </Button>
      <Button variant="secondary" onClick={handlePdf} disabled={busy !== null}>
        {busy === 'pdf' ? 'Exporting…' : 'Export PDF'}
      </Button>
      {message && <span style={styles.message}>{message}</span>}
    </div>
  );
}

const styles = {
  container: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  message: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
};
