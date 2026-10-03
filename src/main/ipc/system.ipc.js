const { ipcMain, app } = require('electron');
const { getDb } = require('../db/connection');

// Every business/transactional table a factory reset wipes. Deliberately
// excludes dev_panel_config/dev_audit_log/dev_panel_access_log (diagnostic
// tooling and its history should survive a reset — arguably more valuable
// if it shows resets happened, not less) and _migrations (unrelated
// bookkeeping — clearing it would make the migration runner try to reapply
// everything from scratch against an already-latest-schema database).
//
// expense_categories doesn't exist any more (021_expense_recurrence.sql
// dropped it in favor of recurring_expenses); activity_log (cashier session
// history, 019_activity_log.sql) is included too — it's per-user business
// data, not diagnostic tooling.
const TABLES_TO_CLEAR = [
  'sale_return_items',
  'sale_returns',
  'sales',
  'sale_items',
  'payments',
  'purchases',
  'purchase_items',
  'stock_movements',
  'products',
  'product_variants',
  'product_units',
  'categories',
  'customers',
  'suppliers',
  'letterheads',
  'percentage_pricing_rules',
  'expenses',
  'recurring_expenses',
  'ledger_adjustments',
  'activity_log',
  'users',
  'user_permissions',
  'sessions',
  'sync_outbox',
  'sync_peer_state',
  'sync_log',
];

// Wipes all business data and the activation record, sending the app back
// to the Setup/Choose-Role screen on next boot. Does NOT unmark the consumed
// license_keys row — a reset requires a brand new key; the old one stays
// permanently used.
//
// A lot of the FKs among these tables (e.g. sales.cashier_id -> users,
// purchases.supplier_id -> suppliers) carry no ON DELETE CASCADE, so with
// enforcement on, no delete order avoids a "FOREIGN KEY constraint failed"
// once both sides of a relationship are being wiped. foreign_keys is a
// connection-level pragma that SQLite refuses to change mid-transaction, so
// it's switched off before BEGIN and back on after COMMIT/ROLLBACK; nothing
// else touches this connection in between since the whole function runs
// synchronously with no awaits.
function factoryReset() {
  const db = getDb();

  db.pragma('foreign_keys = OFF');
  try {
    db.exec('BEGIN');
    for (const table of TABLES_TO_CLEAR) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare('DELETE FROM license_activation').run();
    db.exec('COMMIT');
    return { success: true };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Nothing to roll back if BEGIN itself never committed any work.
    }
    return { success: false, reason: err.message || 'Could not reset the app.' };
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function relaunchApp() {
  app.relaunch();
  app.exit();
}

function registerSystemIpc() {
  ipcMain.handle('system:factory-reset', () => {
    const result = factoryReset();
    if (result.success) relaunchApp();
    return result;
  });
}

module.exports = { registerSystemIpc };
