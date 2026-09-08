import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { formatCurrencyExact, formatDateTime } from '../../utils/format';

// Fallback A4 invoice — rendered only when a sale has no assigned letterhead
// AND no default letterhead exists (printA4Invoice.js's printInvoice() picks
// between this HTML page and the letterhead-PDF-merge path). Same hidden
// BrowserWindow + webContents.print() pattern as PrintPaymentReceipt.jsx.
// Plain-text header from receipt_header_text stands in for the letterhead
// image; receipt_footer_text applies here exactly as it does on the merged
// path, since the footer is independent of which header a given invoice used.
export default function PrintInvoice({ saleId, showDues }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    window.api.sales.getReceiptData({ saleId: Number(saleId), showDues: !!showDues }).then((res) => {
      if (res && res.sale) setData(res);
      else setNotFound(true);
    });
    window.api.settings.getAll().then(setSettings);
  }, [saleId, showDues]);

  if (notFound) return <div style={styles.page}>Sale not found.</div>;
  if (!data || !settings) return <div style={styles.page}>Loading…</div>;

  const { sale, items, showDues: applyDues, outstandingBalance } = data;
  const currency = settings.currency_symbol || 'Rs.';
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;

  const headerLines = (settings.receipt_header_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const footerLines = (settings.receipt_footer_text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        {headerLines.length > 0 ? (
          headerLines.map((line, i) => (
            <div key={i} style={i === 0 ? styles.shopName : styles.shopMeta}>
              {line}
            </div>
          ))
        ) : (
          <div style={styles.shopName}>&nbsp;</div>
        )}
      </div>

      <div style={styles.title}>INVOICE</div>

      <div style={styles.infoBox}>
        <div>
          <div style={styles.label}>Bill To</div>
          <div style={styles.value}>{sale.customer_name || 'Walk-in Customer'}</div>
          {sale.customer_phone && <div style={styles.metaSmall}>{sale.customer_phone}</div>}
          {sale.customer_address && <div style={styles.metaSmall}>{sale.customer_address}</div>}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.label}>Invoice Details</div>
          <div style={styles.metaSmall}>Invoice No: {sale.invoice_no}</div>
          <div style={styles.metaSmall}>Date &amp; Time: {formatDateTime(sale.created_at)}</div>
          <div style={styles.metaSmall}>Cashier: {sale.cashier_name}</div>
        </div>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Item</th>
            <th style={styles.th}>Qty</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Unit Price</th>
            <th style={{ ...styles.th, textAlign: 'right' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const label =
              item.variant_name && item.variant_name !== 'Standard' ? `${item.product_name} (${item.variant_name})` : item.product_name;
            return (
              <tr key={item.id}>
                <td style={styles.td}>{label}</td>
                <td style={styles.td}>
                  {item.quantity} {item.unit_name}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{money(item.unit_price)}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{money(item.line_total)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={styles.totalsWrap}>
        <div style={styles.totalsBox}>
          <TotalRow label="Subtotal" value={money(sale.subtotal)} />
          {sale.discount_amount > 0 && <TotalRow label="Discount" value={`-${money(sale.discount_amount)}`} />}
          <TotalRow label="Total" value={money(sale.total_amount)} bold shaded />
          <TotalRow label="Paid" value={money(sale.paid_amount)} />
          {sale.balance_due > 0 && <TotalRow label="Balance Due" value={money(sale.balance_due)} bold />}
          {applyDues && <TotalRow label="Total Outstanding Balance" value={money(outstandingBalance)} bold />}
        </div>
      </div>

      {footerLines.length > 0 && (
        <div style={styles.footer}>
          {footerLines.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value, bold, shaded }) {
  return (
    <div style={{ ...styles.totalRow, ...(shaded ? styles.totalRowShaded : {}), ...(bold ? { fontWeight: theme.font.weightSemibold } : {}) }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Plain black-on-white, print-appropriate — same convention as
// PrintPaymentReceipt.jsx, just with an item table added.
const styles = {
  page: { backgroundColor: '#ffffff', color: '#111827', fontFamily: theme.font.family, padding: '40px', minHeight: '100vh', boxSizing: 'border-box' },
  header: { textAlign: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '2px solid #111827' },
  shopName: { fontSize: '20px', fontWeight: theme.font.weightSemibold },
  shopMeta: { color: '#4b5563', fontSize: theme.font.sizeSm, marginTop: '2px' },
  title: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, textAlign: 'center', letterSpacing: '0.08em', margin: '4px 0 20px' },
  infoBox: { display: 'flex', justifyContent: 'space-between', gap: '24px', border: '1px solid #111827', padding: '14px 16px', marginBottom: '20px' },
  label: { color: '#6b7280', fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '4px' },
  value: { fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold },
  metaSmall: { color: '#4b5563', fontSize: theme.font.sizeSm, marginTop: '2px' },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: theme.font.sizeSm },
  th: { textAlign: 'left', padding: '8px 10px', backgroundColor: '#e5e7eb', border: '1px solid #111827' },
  td: { padding: '8px 10px', border: '1px solid #111827' },
  totalsWrap: { display: 'flex', justifyContent: 'flex-end' },
  totalsBox: { width: '320px', border: '1px solid #111827' },
  totalRow: { display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontSize: theme.font.sizeSm, borderBottom: '1px solid #111827' },
  totalRowShaded: { backgroundColor: '#e5e7eb' },
  footer: { marginTop: '32px', textAlign: 'center', color: '#6b7280', fontSize: theme.font.sizeXs },
};
