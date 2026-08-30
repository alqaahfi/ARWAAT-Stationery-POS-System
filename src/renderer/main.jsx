import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.jsx';
import PrintReport from './pages/Print/PrintReport.jsx';

// A hidden BrowserWindow used for PDF export (see exportReportPdf.js on the
// main process side) loads this exact same bundle with `?print=1` on the
// query string, instead of a second Vite entry point — cheaper than wiring a
// whole separate HTML/build target for one print-only view. When present, it
// bypasses AuthProvider/the sidebar app entirely and renders just the plain,
// printable report.
const params = new URLSearchParams(window.location.search);
const isPrintMode = params.get('print') === '1';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isPrintMode ? (
      <PrintReport reportType={params.get('reportType')} filters={JSON.parse(params.get('filters') || '{}')} />
    ) : (
      <App />
    )}
  </React.StrictMode>
);
