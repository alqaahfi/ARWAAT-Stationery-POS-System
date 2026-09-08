import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextArea, Button, Banner, HelperText } from '../../components/ui';

// What actually prints on a receipt is unrelated to the app's own UI
// branding (see appInfo.js) — this is the shop's real identity, free-text so
// the admin controls exactly what shows up, in whatever format they want.
// Feeds thermalReceipt.js / ThermalContent.jsx's header+footer directly, and
// printA4Invoice.js's plain-text fallback header (no letterhead assigned)
// plus every A4 invoice's footer regardless of letterhead.
export default function ReceiptContent() {
  const { user } = useAuth();

  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.settings.getAll().then((s) => {
      setHeaderText(s.receipt_header_text || '');
      setFooterText(s.receipt_footer_text || '');
      setPaperWidth(s.thermal_paper_width || '58mm');
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setError('');
    setSaved(false);
    setSaving(true);
    const res = await window.api.settings.setMany({
      receipt_header_text: headerText,
      receipt_footer_text: footerText,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save receipt content.');
      return;
    }
    setSaved(true);
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
      <PageHeader title="Receipt Header & Footer" />
      <div style={styles.layout}>
        <Card style={{ flex: '1 1 380px' }}>
          <Label>Header Lines</Label>
          <TextArea
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            placeholder={'ARWAAT Stationery Store\n123 Main Road, Lahore\n0300-1234567'}
            style={{ minHeight: '110px' }}
          />
          <HelperText>
            Printed at the top of every thermal receipt, exactly as typed — one line per line. Shop name, address, phone,
            a tagline: your choice, no fixed structure.
          </HelperText>

          <Label>Footer Lines</Label>
          <TextArea
            value={footerText}
            onChange={(e) => setFooterText(e.target.value)}
            placeholder={'Thank you for shopping with us!\nExchange within 7 days with receipt.'}
            style={{ minHeight: '90px' }}
          />
          <HelperText>
            Printed at the bottom of every thermal receipt, and on every A4 invoice (below the totals, whether or not a
            letterhead is used for the header).
          </HelperText>

          <Banner>{error}</Banner>
          {saved && !error && <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>Saved.</div>}

          <Button onClick={handleSave} disabled={saving} style={{ marginTop: theme.spacing.lg }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Card>

        <ReceiptPreview headerText={headerText} footerText={footerText} paperWidth={paperWidth} />
      </div>
    </div>
  );
}

// Rough mockup of a thermal receipt, at the same width Printer Settings has
// configured, so the admin can see what they're actually creating without
// printing a test receipt every time it changes.
function ReceiptPreview({ headerText, footerText, paperWidth }) {
  const width = paperWidth === '80mm' ? 300 : 230;
  const headerLines = headerText.split('\n').filter((l) => l.trim() !== '');
  const footerLines = footerText.split('\n').filter((l) => l.trim() !== '');

  return (
    <Card style={{ flex: '0 0 auto' }}>
      <div style={styles.previewLabel}>Preview ({paperWidth})</div>
      <div style={{ ...styles.receipt, width: `${width}px` }}>
        {headerLines.length > 0 ? (
          headerLines.map((line, i) => (
            <div key={i} style={i === 0 ? styles.receiptHeaderFirst : styles.receiptCenter}>
              {line}
            </div>
          ))
        ) : (
          <div style={{ ...styles.receiptCenter, color: '#9ca3af' }}>(no header lines set)</div>
        )}

        <div style={styles.hr} />
        <div style={{ color: '#9ca3af' }}>Invoice: INV-0001</div>
        <div style={{ color: '#9ca3af' }}>...items...</div>
        <div style={styles.lr}>
          <span style={{ color: '#9ca3af' }}>Total</span>
          <span style={{ color: '#9ca3af' }}>Rs.0.00</span>
        </div>
        <div style={styles.hr} />

        {footerLines.length > 0 ? (
          footerLines.map((line, i) => (
            <div key={i} style={styles.receiptCenter}>
              {line}
            </div>
          ))
        ) : (
          <div style={{ ...styles.receiptCenter, color: '#9ca3af' }}>(no footer lines set)</div>
        )}
      </div>
    </Card>
  );
}

const styles = {
  layout: { display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap', alignItems: 'flex-start' },
  previewLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: theme.spacing.sm },
  receipt: {
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '14px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadow.card,
    boxSizing: 'border-box',
  },
  receiptCenter: { textAlign: 'center' },
  receiptHeaderFirst: { textAlign: 'center', fontWeight: 700 },
  hr: { borderTop: '1px dashed #000000', margin: '8px 0' },
  lr: { display: 'flex', justifyContent: 'space-between' },
};
