// The ARWAAT credit line printed at the bottom of every printed or exported
// document (thermal receipts, A4 invoices / purchase receipts, payment
// receipts, report PDFs, the printer test page). Fixed on purpose — not a
// setting, not editable. The renderer's print views use the copy in
// renderer/config/appInfo.js (PRINT_BRANDING_LINE); keep the two identical.
const BRANDING_LINE = 'Software by ARWAAT · 0319 2224504 · arwaat.com';

module.exports = { BRANDING_LINE };
