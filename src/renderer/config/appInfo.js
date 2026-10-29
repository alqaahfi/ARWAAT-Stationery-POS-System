// src/renderer/config/appInfo.js
//
// The app's own UI is no longer per-shop-branded — every place the app's own
// chrome (sidebar, login screen, window title, etc.) shows a name, it shows
// this fixed string, identical across every installation. This is the one
// place that string is spelled out, so it can never drift between screens.
// What actually prints on customer-facing receipts is unrelated and lives in
// the receipt_header_text / receipt_footer_text settings instead (see
// Settings > Receipt Header & Footer) — that's the shop's own real identity,
// this is the app's.
export const APP_NAME = 'ARWAAT Stationery Systems';

// The fixed ARWAAT credit line at the bottom of every print view (pages/Print/*,
// components/receipt/ThermalContent.jsx). Renderer copy of
// src/shared/branding.js — keep the two identical. Not a setting.
export const PRINT_BRANDING_LINE = 'Software by ARWAAT · 0319 2224504 · arwaat.com';
