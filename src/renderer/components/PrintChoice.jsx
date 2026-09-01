import React from 'react';
import theme from '../config/theme';
import { Button } from './ui';
import { printPaymentReceipt } from '../utils/printPayment';

// The admin-chooses-format-each-time step used everywhere a payment receipt
// can be printed in the Ledgers module — right after recording a payment,
// and again for the Reprint action on Payment History. Same three choices,
// same two underlying print paths, wherever it shows up.
export default function PrintChoice({ paymentId, onDone, inline }) {
  async function choose(format) {
    if (format) await printPaymentReceipt(paymentId, format);
    onDone();
  }

  return (
    <div style={inline ? styles.inlineRow : styles.row}>
      {!inline && <span style={styles.label}>Print Receipt:</span>}
      <Button variant="secondary" style={styles.btn} onClick={() => choose('thermal')}>
        Thermal
      </Button>
      <Button variant="secondary" style={styles.btn} onClick={() => choose('a4')}>
        A4
      </Button>
      <Button variant="ghost" style={styles.btn} onClick={() => choose(null)}>
        Don't Print
      </Button>
    </div>
  );
}

const styles = {
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.lg, flexWrap: 'wrap' },
  inlineRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  label: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  btn: { padding: '6px 12px', fontSize: theme.font.sizeXs },
};
