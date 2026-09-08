import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { formatCurrencyExact, formatDateTime } from '../../utils/format';

// Rendered only inside the hidden BrowserWindow that printA4Invoice.js's
// printPaymentReceipt() (main process) drives — no sidebar, no top bar, no
// interactive chrome. Same clean print-only layout convention as
// PrintInvoice.jsx, just for a single payment instead of a whole sale.
export default function PrintPaymentReceipt({ paymentId }) {
  const [payment, setPayment] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.api.ledgers.getPaymentById({ id: Number(paymentId) }).then((res) => {
      if (res.success) setPayment(res.payment);
      else setNotFound(true);
    });
    window.api.settings.getAll().then(setSettings);
  }, [paymentId]);

  if (notFound) return <div style={styles.page}>Payment not found.</div>;
  if (!payment || !settings) return <div style={styles.page}>Loading…</div>;

  const headerLines = (settings.receipt_header_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const footerLines = (settings.receipt_footer_text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {headerLines.map((line, i) => (
          <div key={i} style={i === 0 ? styles.shopName : styles.shopMeta}>
            {line}
          </div>
        ))}
      </div>

      <div style={styles.title}>Payment Receipt</div>

      <div style={styles.metaRow}>
        <div>
          <div style={styles.label}>{payment.party_type === 'customer' ? 'Received From' : 'Paid To'}</div>
          <div style={styles.value}>{payment.party_name || '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.label}>Receipt No</div>
          <div style={styles.value}>#{payment.id}</div>
          <div style={styles.metaSmall}>{formatDateTime(payment.created_at)}</div>
        </div>
      </div>

      <div style={styles.amountBlock}>
        <div style={styles.amountLabel}>Amount</div>
        <div style={styles.amountValue}>{formatCurrencyExact(payment.amount)}</div>
      </div>

      <div style={styles.detailsBlock}>
        <DetailRow label="Payment Method" value={payment.payment_method} />
        {payment.note && <DetailRow label="Note" value={payment.note} />}
        <DetailRow label="Recorded By" value={payment.recorded_by_name || '—'} />
      </div>

      <div style={styles.footer}>
        {footerLines.length > 0 ? footerLines.map((line, i) => <div key={i}>{line}</div>) : 'Thank you.'}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={styles.detailRow}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ textTransform: 'capitalize' }}>{value}</span>
    </div>
  );
}

// Plain black-on-white, print-appropriate — same convention as PrintInvoice.jsx.
const styles = {
  page: { backgroundColor: '#ffffff', color: '#111827', fontFamily: theme.font.family, padding: '32px', minHeight: '100vh' },
  header: { marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #111827' },
  shopName: { fontSize: '20px', fontWeight: theme.font.weightSemibold },
  shopMeta: { color: '#4b5563', fontSize: theme.font.sizeSm, marginTop: '2px' },
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, margin: '16px 0' },
  metaRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '20px', gap: '24px' },
  label: { color: '#6b7280', fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  value: { fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold, marginTop: '2px' },
  metaSmall: { color: '#4b5563', fontSize: theme.font.sizeSm, marginTop: '2px' },
  amountBlock: { padding: '16px 0', borderTop: '1px solid #d1d5db', borderBottom: '1px solid #d1d5db', marginBottom: '16px' },
  amountLabel: { color: '#6b7280', fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  amountValue: { fontSize: '28px', fontWeight: theme.font.weightSemibold, marginTop: '4px' },
  detailsBlock: { maxWidth: '360px' },
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: theme.font.sizeSm },
  footer: { marginTop: '32px', color: '#6b7280', fontSize: theme.font.sizeXs },
};
