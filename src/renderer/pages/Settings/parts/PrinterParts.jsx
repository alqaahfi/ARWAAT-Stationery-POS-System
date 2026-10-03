import React from 'react';
import { FileText, Printer } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Card, ChipGroup, Field, IconTile, Select } from '../../../components/ui';

const c = theme.colors;

const WIDTH_OPTIONS = [
  { value: '58mm', label: '58 mm (narrow)' },
  { value: '80mm', label: '80 mm (wide)' },
];

function CardHead({ icon, color, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, marginBottom: theme.spacing.md }}>
      <IconTile icon={icon} color={color} size="lg" variant="soft" />
      <div>
        <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>{title}</h2>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' }}>{subtitle}</div>
      </div>
    </div>
  );
}

export function ReceiptPrinterCard({ printers, printerName, onPrinterName, paperWidth, onPaperWidth, dirty, saving, onSave, testing, onTest }) {
  const canTest = !!printerName && !dirty;
  return (
    <Card
      footer={
        <>
          <Button variant="secondary" icon={Printer} onClick={onTest} loading={testing} disabled={!canTest}>
            Print a test page
          </Button>
          <Button onClick={onSave} loading={saving} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      <CardHead icon={Printer} color="gray" title={glossary.receiptPrinter} subtitle="The small thermal printer for retail receipts." />
      <Field
        label="Printer"
        hint={printers.length === 0 ? 'No printers found on this computer. Check it’s plugged in and installed in Windows.' : dirty ? 'Save first, then print a test page.' : undefined}
      >
        <Select value={printerName} onChange={(e) => onPrinterName(e.target.value)}>
          <option value="">Choose a printer…</option>
          {printers.map((p) => (
            <option key={p.name} value={p.name}>
              {p.displayName || p.name}
              {p.isDefault ? ' (Windows default)' : ''}
            </option>
          ))}
        </Select>
      </Field>
      <div style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>
        Paper width
      </div>
      <ChipGroup aria-label="Paper width" options={WIDTH_OPTIONS} value={paperWidth} onChange={onPaperWidth} />
    </Card>
  );
}

// A4 invoices always go through the normal Windows print dialog, so there's
// nothing to pick here — this card just says so.
export function A4PrinterCard() {
  return (
    <Card>
      <CardHead icon={FileText} color="blue" title={glossary.a4Printer} subtitle="For wholesale A4 invoices." />
      <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: 0 }}>
        A4 invoices open the Windows print window each time, so you choose the printer there. Nothing to set up here.
      </p>
    </Card>
  );
}
