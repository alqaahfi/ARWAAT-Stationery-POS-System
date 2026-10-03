import React from 'react';
import { Check, RotateCw } from 'lucide-react';
import theme from '../../../config/theme';
import { formatCurrency } from '../../../utils/format';
import { Badge, Button, IconTile, Kbd, Spinner } from '../../../components/ui';
import ThermalContent from '../../../components/receipt/ThermalContent';
import { Money, Scrim, c, keepFocus } from './common';

// Local filesystem paths need the file:// scheme (and a third slash on
// Windows) to load as a src — same helper used across the Print pages.
function toFileUrl(p) {
  if (!p) return null;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

// Shown whether or not the physical print worked. Enter / Esc / R are
// handled by Sale.jsx; the buttons here are the mouse fallback.
export default function SaleCompleteSheet({ data, receiptPreview, retrying, onRetry, onClose, closeLabel = 'New sale' }) {
  return (
    <Scrim labelledBy="pos-complete-title">
      <div style={styles.sheet}>
        <div style={styles.previewPane}>
          <ReceiptPreview data={data} receiptPreview={receiptPreview} />
        </div>

        <div style={styles.side}>
          <IconTile icon={Check} color="green" size="xl" />
          <div id="pos-complete-title" style={{ ...theme.type.title1, color: c.label, marginTop: theme.spacing.md }}>
            Sale complete
          </div>
          <div style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary }}>Invoice {data.invoiceNo}</div>

          <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.lg, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total
          </div>
          <Money value={formatCurrency(data.totalAmount)} style={styles.total} />
          {data.changeDue > 0 && (
            <div style={{ ...theme.type.headline, ...theme.font.numeric, color: c.greenText }}>Change to give back: {formatCurrency(data.changeDue)}</div>
          )}
          {data.balanceDue > 0 && (
            <div style={{ ...theme.type.headline, ...theme.font.numeric, color: c.orangeText }}>Balance due: {formatCurrency(data.balanceDue)}</div>
          )}

          <div style={styles.printRow} onMouseDown={keepFocus}>
            {data.printSuccess ? (
              <Badge tone="green" dot>
                Printed
              </Badge>
            ) : (
              <>
                <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                  <Badge tone="red" dot style={{ alignSelf: 'flex-start' }}>
                    Print failed
                  </Badge>
                  <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>{data.printReason || 'Could not print — check the printer.'}</span>
                </div>
                <Button variant="secondary" size="sm" icon={retrying ? undefined : RotateCw} loading={retrying} tabIndex={-1} onClick={onRetry}>
                  Retry <Kbd>R</Kbd>
                </Button>
              </>
            )}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: theme.spacing.lg }} onMouseDown={keepFocus}>
            <Button size="lg" fullWidth tabIndex={-1} onClick={onClose} style={{ height: '48px' }}>
              {closeLabel} <Kbd>Enter</Kbd>
            </Button>
          </div>
        </div>
      </div>
    </Scrim>
  );
}

// A4 embeds the merged PDF the print path wrote; thermal renders the same
// shared content the physical print is formatted from.
function ReceiptPreview({ data, receiptPreview }) {
  if (data.printType === 'wholesale-a4') {
    return data.pdfPath ? (
      <embed src={toFileUrl(data.pdfPath)} type="application/pdf" style={styles.pdf} />
    ) : (
      <div style={styles.previewNote}>No invoice preview available.</div>
    );
  }
  if (!receiptPreview) {
    return (
      <div style={styles.previewNote}>
        <Spinner size={16} /> Loading receipt…
      </div>
    );
  }
  return (
    <div style={styles.paper}>
      <ThermalContent data={receiptPreview.data} settings={receiptPreview.settings} />
    </div>
  );
}

const styles = {
  sheet: {
    width: '720px',
    maxWidth: '100%',
    height: '560px',
    maxHeight: 'calc(100vh - 48px)',
    display: 'flex',
    backgroundColor: c.surface,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
    overflow: 'hidden',
  },
  previewPane: {
    width: '360px',
    flexShrink: 0,
    backgroundColor: c.bg,
    borderRight: `1px solid ${c.separator}`,
    padding: theme.spacing.mdl,
    boxSizing: 'border-box',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    backgroundColor: c.surface,
    color: c.label,
    boxShadow: theme.shadow.dropdown,
    borderRadius: theme.radius.xs,
    padding: '16px',
    fontFamily: theme.font.mono,
    fontSize: '12px',
    lineHeight: '1.6',
  },
  pdf: { width: '100%', flex: 1, minHeight: '400px', border: 'none', borderRadius: theme.radius.xs, boxShadow: theme.shadow.dropdown },
  previewNote: { margin: 'auto', display: 'flex', alignItems: 'center', gap: theme.spacing.sm, ...theme.type.subhead, color: c.labelSecondary },
  side: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: theme.spacing.lg },
  total: { display: 'block', fontSize: '36px', lineHeight: '44px', fontWeight: theme.font.weightBold, letterSpacing: '-0.02em', color: c.label },
  printRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    backgroundColor: c.surfaceAlt,
    border: `1px solid ${c.separator}`,
  },
};
