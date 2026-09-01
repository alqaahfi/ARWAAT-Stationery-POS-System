import React, { useEffect, useRef, useState } from 'react';
import theme from '../../config/theme';
import ThermalContent from '../../components/receipt/ThermalContent';

// Dev-mode stand-in for the silent thermal print path (see receiptPreview.js
// on the main process side) — no physical receipt printer to test against
// yet, so this is a real, visible window mocking up what the receipt would
// look like, with an "Export as Image" button instead of a print action.
// Unlike PrintReport/PrintInvoice (headless, captured automatically by the
// main process), this page has actual interactive chrome since a person is
// meant to look at it. The receipt body itself is ThermalContent, shared
// with the on-screen post-checkout preview popup in Sale.jsx.
export default function PrintReceipt({ saleId, showDues }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const receiptRef = useRef(null);

  useEffect(() => {
    window.api.sales.getReceiptData({ saleId: Number(saleId), showDues: !!showDues }).then(setData);
    window.api.settings.getAll().then(setSettings);
  }, [saleId, showDues]);

  async function handleExportImage() {
    if (!receiptRef.current) return;
    setSaving(true);
    setMessage('');

    const rect = receiptRef.current.getBoundingClientRect();
    const res = await window.api.printing.captureReceiptImage({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
    setSaving(false);

    if (res.canceled) return;
    setMessage(res.success ? `Saved to ${res.filePath}` : res.reason || 'Could not save image.');
  }

  if (!data || !settings) return <div style={styles.wrapper}>Loading…</div>;
  if (!data.sale) return <div style={styles.wrapper}>Sale not found.</div>;

  const receiptWidth = settings.thermal_paper_width === '80mm' ? 380 : 300;

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarTitle}>Receipt Preview — dev mode (no thermal printer configured)</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={styles.btn} onClick={handleExportImage} disabled={saving}>
            {saving ? 'Saving…' : 'Export as Image'}
          </button>
          <button style={styles.btnGhost} onClick={() => window.close()}>
            Close
          </button>
        </div>
        {message && <div style={styles.message}>{message}</div>}
      </div>

      <div ref={receiptRef} style={{ ...styles.receipt, width: `${receiptWidth}px` }}>
        <ThermalContent data={data} settings={settings} />
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    backgroundColor: '#eef1f5',
    minHeight: '100vh',
    padding: '20px',
    fontFamily: theme.font.family,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    boxSizing: 'border-box',
  },
  toolbar: { display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', textAlign: 'center' },
  toolbarTitle: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  btn: {
    padding: '9px 18px',
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: theme.colors.primary,
    color: theme.colors.primaryText,
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
    fontFamily: theme.font.family,
  },
  btnGhost: {
    padding: '9px 18px',
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
    fontFamily: theme.font.family,
  },
  message: { fontSize: theme.font.sizeXs, color: theme.colors.textSecondary },
  receipt: {
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '16px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    boxSizing: 'border-box',
  },
};
