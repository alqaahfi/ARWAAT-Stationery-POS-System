import React from 'react';
import { formatDateTime } from '../../utils/format';
import { PRINT_BRANDING_LINE } from '../../config/appInfo';

// The thermal receipt's actual content — shared between the preview
// window and on-screen post-checkout popup.
export default function ThermalContent({ data, settings = {} }) {
  const { sale, groups, showDues, outstandingBalance } = data;
  const currency = settings.currency_symbol || 'Rs.';
  const money = (n) => `${currency}${Number(n || 0).toFixed(2)}`;

  const isModern = settings.thermal_font_style === 'modern';
  const fontFamily = isModern
    ? "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    : "Consolas, 'Courier New', Monaco, 'SF Mono', monospace";

  const headerLines = (settings.receipt_header_text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const footerLines = (settings.receipt_footer_text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  return (
    <div style={{ fontFamily, fontSize: isModern ? '12px' : '11.5px', lineHeight: 1.45, color: '#000000', width: '100%', boxSizing: 'border-box' }}>
      {/* Header section */}
      <div style={styles.center}>
        {headerLines.map((line, i) => (
          <div
            key={i}
            style={
              i === 0
                ? { fontWeight: 700, fontSize: isModern ? '15px' : '14px', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '2px' }
                : { fontSize: isModern ? '11px' : '10.5px', color: '#333333' }
            }
          >
            {line}
          </div>
        ))}
      </div>
      <div style={styles.hr} />

      {/* Stamp Lines (e.g. DUPLICATE COPY / VOIDED) */}
      {data.stampLines && data.stampLines.length > 0 && (
        <>
          <div style={{ ...styles.center, padding: '4px 0', border: '1px solid #000000', margin: '4px 0' }}>
            {data.stampLines.map((line, i) => (
              <div key={i} style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em' }}>
                *** {line} ***
              </div>
            ))}
          </div>
          <div style={styles.hr} />
        </>
      )}

      {/* Invoice Meta */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: isModern ? '11px' : '10.5px' }}>
        <div style={styles.lr}>
          <span style={{ color: '#555555' }}>Invoice:</span>
          <span style={{ fontWeight: 700 }}>{sale.invoice_no}</span>
        </div>
        <div style={styles.lr}>
          <span style={{ color: '#555555' }}>Date:</span>
          <span>{formatDateTime(sale.created_at)}</span>
        </div>
        <div style={styles.lr}>
          <span style={{ color: '#555555' }}>Cashier:</span>
          <span>{sale.cashier_name}</span>
        </div>
        {sale.customer_name && (
          <div style={styles.lr}>
            <span style={{ color: '#555555' }}>Customer:</span>
            <span style={{ fontWeight: 600 }}>{sale.customer_name}</span>
          </div>
        )}
      </div>

      <div style={styles.hr} />

      {/* Table Column Titles */}
      <div style={{ ...styles.lr, fontSize: '10px', fontWeight: 700, color: '#444444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        <span>Item / Description</span>
        <span>Amount</span>
      </div>
      <div style={{ borderTop: '0.5px solid #000000', marginBottom: '6px' }} />

      {/* Items list */}
      {groups.map((group, i) => (
        <div key={i} style={{ marginBottom: '6px' }}>
          <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{group.product_name}</div>
          {group.variantText && <div style={{ fontSize: '10px', color: '#555555', paddingLeft: '8px' }}>{group.variantText}</div>}
          <div style={{ ...styles.lr, fontSize: isModern ? '11px' : '10.5px', marginTop: '1px' }}>
            <span style={{ color: '#444444' }}>
              {group.quantity} {group.unit_name} &times; {money(group.unit_price)}
            </span>
            <span style={{ fontWeight: 600 }}>{money(group.line_total)}</span>
          </div>
        </div>
      ))}

      <div style={styles.hr} />

      {/* Summary / Totals block */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <div style={styles.lr}>
          <span style={{ color: '#555555' }}>Subtotal:</span>
          <span>{money(sale.subtotal)}</span>
        </div>
        {sale.discount_amount > 0 && (
          <div style={styles.lr}>
            <span style={{ color: '#555555' }}>Discount:</span>
            <span>&minus;{money(sale.discount_amount)}</span>
          </div>
        )}
        <div style={{ ...styles.lr, fontSize: isModern ? '14px' : '13px', fontWeight: 700, borderTop: '1px solid #000000', borderBottom: '1px solid #000000', padding: '4px 0', margin: '2px 0' }}>
          <span>TOTAL:</span>
          <span>{money(sale.total_amount)}</span>
        </div>
        <div style={styles.lr}>
          <span style={{ color: '#555555' }}>Paid:</span>
          <span>{money(sale.paid_amount)}</span>
        </div>
        {sale.balance_due > 0 && (
          <div style={{ ...styles.lr, fontWeight: 700 }}>
            <span>Balance Due:</span>
            <span>{money(sale.balance_due)}</span>
          </div>
        )}
        {showDues && (
          <div style={{ ...styles.lr, fontWeight: 700, marginTop: '2px', padding: '3px 0', borderTop: '0.5px dashed #000000' }}>
            <span>Total Outstanding:</span>
            <span>{money(outstandingBalance)}</span>
          </div>
        )}
      </div>

      {/* Footer Notes */}
      {footerLines.length > 0 && (
        <>
          <div style={styles.hr} />
          <div style={{ ...styles.center, fontSize: isModern ? '11px' : '10px', color: '#333333' }}>
            {footerLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </>
      )}

      {/* Fixed ARWAAT Line */}
      <div style={styles.thinHr} />
      <div style={styles.branding}>{PRINT_BRANDING_LINE}</div>
    </div>
  );
}

const styles = {
  center: { textAlign: 'center' },
  hr: { borderTop: '1px dashed #000000', margin: '6px 0' },
  lr: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  thinHr: { borderTop: '0.5px solid #aaaaaa', margin: '8px 0 4px' },
  branding: { textAlign: 'center', fontSize: '9px', color: '#666666' },
};
