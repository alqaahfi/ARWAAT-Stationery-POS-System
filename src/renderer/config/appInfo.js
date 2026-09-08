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
