import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button, Menu, MenuItem, Popover, useToast } from '../../../components/ui';

function fileName(path) {
  return String(path).split(/[\\/]/).pop();
}

// One "Export" button with a menu: CSV or PDF. rows/columns are the report's
// *current filtered* data — CSV reflects exactly what's on screen.
// `reportType` + `filters` are only needed for the PDF path (the hidden print
// window re-fetches its own data by reportType).
export default function ExportButtons({ rows, columns, reportType, filters, suggestedName }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const empty = !rows || rows.length === 0;

  async function run(exporter) {
    setOpen(false);
    setBusy(true);
    try {
      const res = await exporter();
      if (res?.canceled) return;
      if (res?.success) toast.success(res.filePath ? `Saved to ${fileName(res.filePath)}` : 'Export complete');
      else toast.error(res?.reason || 'Could not export this report.');
    } catch (err) {
      toast.error(err?.message || 'Could not export this report.');
    } finally {
      setBusy(false);
    }
  }

  const handleCsv = () => run(() => window.api.reports.exportCsv({ rows, columns, suggestedName: suggestedName || `${reportType}.csv` }));
  const handlePdf = () => run(() => window.api.reports.exportPdf({ reportType, filters }));

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={280}
      anchor={
        <span title={empty ? 'Nothing to export for these filters' : undefined} style={{ display: 'inline-flex' }}>
          <Button
            variant="secondary"
            icon={Download}
            loading={busy}
            disabled={empty}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {busy ? 'Exporting…' : 'Export'}
          </Button>
        </span>
      }
    >
      <Menu label="Export">
        <MenuItem icon={FileSpreadsheet} label="Download as spreadsheet (CSV)" onClick={handleCsv} />
        <MenuItem icon={FileText} label="Save as PDF" onClick={handlePdf} />
      </Menu>
    </Popover>
  );
}
