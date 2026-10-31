import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { SettingsSkeleton, settingsColumn } from './parts/SettingsParts';
import { A4PrinterCard, ReceiptPrinterCard } from './parts/PrinterParts';

// A4 wholesale invoices always go through the normal OS print dialog (the
// admin/cashier picks the printer there, every time) — this page only ever
// configures the thermal RETAIL receipt printer.
export default function PrinterSettings() {
  const { user } = useAuth();
  const toast = useToast();

  const [installedPrinters, setInstalledPrinters] = useState([]);
  const [printerName, setPrinterName] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm');
  const [fontStyle, setFontStyle] = useState('monospace');
  const [initial, setInitial] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    window.api.printers
      .listInstalled()
      .then((list) => setInstalledPrinters(list || []))
      .catch(() => setInstalledPrinters([]));
    window.api.settings
      .getAll()
      .then((s) => {
        const name = s.thermal_printer_name || '';
        const width = s.thermal_paper_width || '58mm';
        const font = s.thermal_font_style || 'monospace';
        setPrinterName(name);
        setPaperWidth(width);
        setFontStyle(font);
        setInitial({ name, width, font });
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await window.api.settings.setMany({
        thermal_printer_name: printerName,
        thermal_paper_width: paperWidth,
        thermal_font_style: fontStyle,
      });
      if (!res.success) {
        toast.error(res.reason || 'Could not save printer settings.');
        return;
      }
      setInitial({ name: printerName, width: paperWidth, font: fontStyle });
      toast.success('Printer settings saved');
    } catch {
      toast.error('Could not save printer settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestPrint() {
    setTesting(true);
    try {
      const res = await window.api.printers.testPrint();
      if (res?.success) toast.success('Test page sent to the printer');
      else toast.error(res?.reason || 'Test print failed.');
    } catch {
      toast.error('Test print failed.');
    } finally {
      setTesting(false);
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (loadFailed) return <LoadError message="Printer settings couldn't be loaded." onRetry={load} />;
  if (!initial) return <SettingsSkeleton />;

  const dirty = printerName !== initial.name || paperWidth !== initial.width || fontStyle !== initial.font;

  return (
    <div style={settingsColumn}>
      <ReceiptPrinterCard
        printers={installedPrinters}
        printerName={printerName}
        onPrinterName={setPrinterName}
        paperWidth={paperWidth}
        onPaperWidth={setPaperWidth}
        fontStyle={fontStyle}
        onFontStyle={setFontStyle}
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        testing={testing}
        onTest={handleTestPrint}
      />
      <A4PrinterCard />
    </div>
  );
}
