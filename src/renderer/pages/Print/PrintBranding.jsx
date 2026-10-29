import React from 'react';
import { PRINT_BRANDING_LINE } from '../../config/appInfo';

// The fixed ARWAAT line at the bottom of every HTML print view (A4 invoice
// fallback, payment receipts, report PDFs). Small, grey, centered, and always
// the last thing in the document, so nothing can overlap it. Print views are
// raw black-on-white by design (no theme tokens).
export default function PrintBranding({ style }) {
  return <div style={{ ...styles.line, ...style }}>{PRINT_BRANDING_LINE}</div>;
}

const styles = {
  line: {
    marginTop: '28px',
    paddingTop: '6px',
    borderTop: '0.5px solid #cccccc',
    textAlign: 'center',
    fontSize: '9px',
    color: '#888888',
    breakInside: 'avoid',
  },
};
