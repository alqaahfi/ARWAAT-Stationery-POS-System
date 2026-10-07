// Window events shared across distant parts of the app.

// Fired (by preload.js) after any call that can change stock levels or the
// product list; the header's alert badge listens so Running Low never goes stale.
export const STOCK_CHANGED_EVENT = 'pos:stock-changed';
