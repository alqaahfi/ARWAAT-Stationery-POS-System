import React, { useEffect, useState } from 'react';
import ThermalContent from '../../components/receipt/ThermalContent';

// Headless thermal-receipt view. The main process (previewDocument.js) loads
// this in a hidden window, measures its height and prints it to a PDF sized to
// the paper roll — that PDF is what the Print Preview window shows. Plain
// black-on-white, full width of the page, no chrome. The receipt body itself is
// ThermalContent, shared with the on-screen post-checkout receipt in Sale.jsx.
export default function PrintReceipt({ saleId, showDues }) {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    window.api.sales.getReceiptData({ saleId: Number(saleId), showDues: !!showDues }).then(setData);
    window.api.settings.getAll().then(setSettings);
  }, [saleId, showDues]);

  if (!data || !settings) return <div style={styles.receipt}>Loading…</div>;
  if (!data.sale) return <div style={styles.receipt}>Sale not found.</div>;

  return (
    <div style={styles.receipt}>
      <ThermalContent data={data} settings={settings} />
    </div>
  );
}

const styles = {
  receipt: {
    backgroundColor: '#ffffff',
    color: '#000000',
    padding: '8px 10px',
    fontFamily: "'Courier New', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    boxSizing: 'border-box',
    width: '100%',
  },
};
