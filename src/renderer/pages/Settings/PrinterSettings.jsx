import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, Button, Banner, HelperText } from '../../components/ui';

// A4 wholesale invoices always go through the normal OS print dialog (the
// admin/cashier picks the printer there, every time) — this page only ever
// configures the thermal RETAIL receipt printer.
export default function PrinterSettings() {
  const { user } = useAuth();

  const [installedPrinters, setInstalledPrinters] = useState([]);
  const [printerName, setPrinterName] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.printers.listInstalled().then(setInstalledPrinters);
    window.api.settings.getAll().then((s) => {
      setPrinterName(s.thermal_printer_name || '');
      setPaperWidth(s.thermal_paper_width || '58mm');
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setError('');
    setSaved(false);
    setSaving(true);
    const res = await window.api.settings.setMany({
      thermal_printer_name: printerName,
      thermal_paper_width: paperWidth,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save printer settings.');
      return;
    }
    setSaved(true);
  }

  async function handleTestPrint() {
    setTesting(true);
    setTestResult(null);
    const res = await window.api.printers.testPrint();
    setTesting(false);
    setTestResult(res);
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!loaded) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title="Printer Settings" />
      <Card style={{ maxWidth: '480px' }}>
        <Label>Thermal Receipt Printer</Label>
        <Select value={printerName} onChange={(e) => setPrinterName(e.target.value)}>
          <option value="">Select a printer…</option>
          {installedPrinters.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName || p.name}
              {p.isDefault ? ' (Windows default)' : ''}
            </option>
          ))}
        </Select>
        {installedPrinters.length === 0 && <HelperText>No printers detected on this PC.</HelperText>}

        <Label>Paper Width</Label>
        <Select value={paperWidth} onChange={(e) => setPaperWidth(e.target.value)}>
          <option value="58mm">58mm (~32 characters/line)</option>
          <option value="80mm">80mm (~42 characters/line)</option>
        </Select>

        <Banner>{error}</Banner>
        {saved && !error && <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>Saved.</div>}

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="secondary" onClick={handleTestPrint} disabled={testing || !printerName}>
            {testing ? 'Printing…' : 'Test Print'}
          </Button>
        </div>

        {testResult && (
          <div style={{ marginTop: theme.spacing.sm, fontSize: theme.font.sizeSm, color: testResult.success ? theme.colors.success : theme.colors.danger }}>
            {testResult.success ? 'Test print sent.' : testResult.reason || 'Test print failed.'}
          </div>
        )}
      </Card>
    </div>
  );
}
