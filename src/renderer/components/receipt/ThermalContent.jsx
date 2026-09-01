import React from 'react';
import { formatDateTime } from '../../utils/format';

// The thermal receipt's actual content — shared between the dev-mode preview
// window (PrintReceipt.jsx, used when no physical thermal printer is
// configured yet) and the on-screen post-checkout preview popup (Sale.jsx),
// so the two can never drift out of sync with each other. The real physical
// print (thermalReceipt.js, raw ESC/POS commands) is necessarily separate
// code — a different output technology entirely — but draws from the same
// buildReceiptData() shape this does. `data` is that shape:
// { sale, items, showDues, outstandingBalance }.
export default function ThermalContent({ data, settings }) {
  const { sale, items, showDues, outstandingBalance } = data;
  const currency = settings.currency_symbol || 'Rs.';
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;

  return (
    <>
      <div style={styles.center}>
        <div style={{ fontWeight: 700 }}>{settings.shop_name || 'Stationery POS'}</div>
        {settings.shop_address && <div>{settings.shop_address}</div>}
        {settings.shop_phone && <div>{settings.shop_phone}</div>}
      </div>
      <div style={styles.hr} />

      <div>Invoice: {sale.invoice_no}</div>
      <div>Date: {formatDateTime(sale.created_at)}</div>
      <div>Cashier: {sale.cashier_name}</div>
      {sale.customer_name && <div>Customer: {sale.customer_name}</div>}
      <div style={styles.hr} />

      {items.map((item) => {
        const label =
          item.variant_name && item.variant_name !== 'Standard' ? `${item.product_name} (${item.variant_name})` : item.product_name;
        return (
          <div key={item.id} style={{ marginBottom: '4px' }}>
            <div>{label}</div>
            <div style={styles.lr}>
              <span>
                &nbsp;&nbsp;{item.quantity} {item.unit_name} x {money(item.unit_price)}
              </span>
              <span>{money(item.line_total)}</span>
            </div>
          </div>
        );
      })}
      <div style={styles.hr} />

      <div style={styles.lr}>
        <span>Subtotal</span>
        <span>{money(sale.subtotal)}</span>
      </div>
      {sale.discount_amount > 0 && (
        <div style={styles.lr}>
          <span>Discount</span>
          <span>-{money(sale.discount_amount)}</span>
        </div>
      )}
      <div style={{ ...styles.lr, fontWeight: 700 }}>
        <span>Total</span>
        <span>{money(sale.total_amount)}</span>
      </div>
      <div style={styles.lr}>
        <span>Paid</span>
        <span>{money(sale.paid_amount)}</span>
      </div>
      {sale.balance_due > 0 && (
        <div style={styles.lr}>
          <span>Balance Due</span>
          <span>{money(sale.balance_due)}</span>
        </div>
      )}
      {showDues && (
        <div style={{ ...styles.lr, fontWeight: 700 }}>
          <span>Total Outstanding</span>
          <span>{money(outstandingBalance)}</span>
        </div>
      )}

      {settings.receipt_footer_text && (
        <>
          <div style={styles.hr} />
          <div style={styles.center}>{settings.receipt_footer_text}</div>
        </>
      )}
    </>
  );
}

const styles = {
  center: { textAlign: 'center' },
  hr: { borderTop: '1px dashed #000000', margin: '8px 0' },
  lr: { display: 'flex', justifyContent: 'space-between' },
};
