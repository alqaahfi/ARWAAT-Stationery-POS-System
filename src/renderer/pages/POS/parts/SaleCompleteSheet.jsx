import React from 'react';
import { Check, FileText, Printer } from 'lucide-react';
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

// Shown after the sale is saved, whether or not the receipt was printed. Enter / Esc / R are
// handled by Sale.jsx; the buttons here are the mouse fallback.
export default function SaleCompleteSheet({ data, receiptPreview, onRetry, onClose, closeLabel = 'New sale' }) {
  const isNoPrint = data.printType === 'none';

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
          <div style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary }}>
            Invoice {data.invoiceNo}
          </div>

          <div
            style={{
              ...theme.type.footnote,
              color: c.labelSecondary,
              marginTop: theme.spacing.lg,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Total
          </div>
          <Money value={formatCurrency(data.totalAmount)} style={styles.total} />
          {data.changeDue > 0 && (
            <div style={{ ...theme.type.headline, ...theme.font.numeric, color: c.greenText }}>
              Change to give back: {formatCurrency(data.changeDue)}
            </div>
          )}
          {data.balanceDue > 0 && (
            <div style={{ ...theme.type.headline, ...theme.font.numeric, color: c.orangeText }}>
              Balance due: {formatCurrency(data.balanceDue)}
            </div>
          )}

          <div style={styles.printRow} onMouseDown={keepFocus}>
            {isNoPrint ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Badge tone="neutral">No receipt printed</Badge>
                <Button variant="secondary" size="sm" icon={FileText} tabIndex={-1} onClick={onRetry}>
                  Preview <Kbd>R</Kbd>
                </Button>
              </div>
            ) : data.printSuccess ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <Badge tone="green" dot>
                  Receipt Printed
                </Badge>
                <Button variant="secondary" size="sm" icon={Printer} tabIndex={-1} onClick={onRetry}>
                  Reprint <Kbd>R</Kbd>
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge tone="red" dot>
                    Not printed
                  </Badge>
                  <Button variant="secondary" size="sm" icon={Printer} tabIndex={-1} onClick={onRetry}>
                    Retry print <Kbd>R</Kbd>
                  </Button>
                </div>
                <span style={{ ...theme.type.footnote, color: c.redText }}>
                  {data.printReason || 'The sale is saved. No printer was ready or configured.'}
                </span>
              </div>
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
      <div style={styles.previewNote}>Press Preview / Print to view the A4 invoice.</div>
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
    flex: '1 1 50%',
    minWidth: 0,
    backgroundColor: c.bg,
    borderRight: `1px solid ${c.separator}`,
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    padding: theme.spacing.md,
  },
  side: {
    flex: '1 1 50%',
    minWidth: 0,
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
  },
  total: {
    ...theme.type.largeTitle,
    ...theme.font.numeric,
    color: c.label,
    marginTop: '2px',
    marginBottom: theme.spacing.sm,
  },
  printRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    backgroundColor: c.fill,
    borderRadius: theme.radius.md,
    minHeight: '44px',
  },
  pdf: { width: '100%', height: '100%', border: 'none' },
  paper: {
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '12px 14px',
    borderRadius: theme.radius.sm,
    boxShadow: theme.shadow.card,
    margin: 'auto 0',
  },
  previewNote: {
    ...theme.type.subhead,
    color: c.labelSecondary,
    margin: 'auto',
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
};
