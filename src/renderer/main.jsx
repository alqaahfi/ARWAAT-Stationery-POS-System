import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import PrintReport from './pages/Print/PrintReport.jsx';
import PrintReceipt from './pages/Print/PrintReceipt.jsx';
import PrintPaymentReceipt from './pages/Print/PrintPaymentReceipt.jsx';
import PrintInvoice from './pages/Print/PrintInvoice.jsx';

// A hidden/standalone BrowserWindow used for PDF export, payment-receipt
// printing, or (dev-mode) the sale receipt preview loads this exact same
// bundle with `?print=1` on the query string, instead of a second Vite entry
// point — cheaper than wiring a whole separate HTML/build target per
// print-only view. When present, it bypasses AuthProvider/the sidebar app
// entirely and renders just the relevant print/preview page — which one
// depends on `printMode` (defaults to 'report' for backward compatibility
// with the Reports PDF flow, which doesn't set it). A4 sale invoices with a
// letterhead assigned are the one exception: those are a merged PDF file
// printed directly (see printA4Invoice.js), not an HTML page rendered
// through this bundle — 'invoice-fallback' below only covers the case where
// no letterhead is set.
const params = new URLSearchParams(window.location.search);
const isPrintMode = params.get('print') === '1';
const printMode = params.get('printMode') || 'report';

function PrintRoot() {
  if (printMode === 'receipt') {
    return <PrintReceipt saleId={params.get('saleId')} showDues={params.get('showDues') === '1'} />;
  }
  if (printMode === 'payment-receipt') {
    return <PrintPaymentReceipt paymentId={params.get('paymentId')} />;
  }
  if (printMode === 'invoice-fallback') {
    return <PrintInvoice saleId={params.get('saleId')} showDues={params.get('showDues') === '1'} />;
  }
  return <PrintReport reportType={params.get('reportType')} filters={JSON.parse(params.get('filters') || '{}')} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isPrintMode ? <PrintRoot /> : <App />}</React.StrictMode>
);
