const { ipcMain } = require('electron');
const { getDb } = require('../db/connection');
const { getCaller } = require('../security/ipcGuard');
const { issueApproval } = require('../security/approvals');
const { checkAdminCredentials } = require('./users.ipc');

// Rule 12: the "Admin approval" box on the cashier screen, the approvals log,
// and the "Stock to recount" list.

// Any signed-in window may ask; the token it gets back only works for that
// window's own signed-in user, for a few minutes, once.
function requestApproval(event, { username, password } = {}) {
  const caller = getCaller(event);
  if (!caller) return { success: false, reason: 'Please sign in again.' };
  const check = checkAdminCredentials(String(username || '').trim(), password);
  if (!check.ok) return { success: false, reason: check.reason };
  const approvalToken = issueApproval({ callerId: caller.userId, adminId: check.user.id, adminName: check.user.fullName });
  return { success: true, approvalToken, adminName: check.user.fullName };
}

const ACTION_LABELS = {
  discount_over_cap: 'Discount above limit',
  sell_without_stock: 'Sold without stock',
  change_old_bill: 'Changed an older bill',
  void_old_bill: 'Voided an older bill',
};

function listApprovals({ dateFrom, dateTo, limit } = {}) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.id, a.action, a.details, a.sale_id, a.invoice_no, a.created_at, a.origin_pc,
              cu.full_name AS cashier_name, au.full_name AS admin_name
       FROM approvals a
       LEFT JOIN users cu ON cu.id = a.cashier_id
       LEFT JOIN users au ON au.id = a.admin_id
       WHERE (@from IS NULL OR date(a.created_at, 'localtime') >= @from)
         AND (@to IS NULL OR date(a.created_at, 'localtime') <= @to)
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT @limit`
    )
    .all({ from: dateFrom || null, to: dateTo || null, limit: Math.min(Math.max(Number(limit) || 200, 1), 1000) });
  return {
    success: true,
    rows: rows.map((r) => ({ ...r, actionText: r.action.split(',').map((a) => ACTION_LABELS[a] || a).join(', ') })),
  };
}

// Open recount entries plus every Type whose stock is below zero (from any cause,
// e.g. two counters selling the last unit at the same time).
function listRecount() {
  const db = getDb();
  const entries = db
    .prepare(
      `SELECT r.id, r.product_variant_id, r.sale_id, r.reason, r.note, r.created_at,
              s.invoice_no, u.full_name AS created_by_name,
              p.id AS product_id, p.name AS product_name, pv.variant_name, pv.stock_qty
       FROM stock_recount r
       JOIN product_variants pv ON pv.id = r.product_variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN sales s ON s.id = r.sale_id
       LEFT JOIN users u ON u.id = r.created_by
       WHERE r.resolved_at IS NULL
       ORDER BY r.created_at DESC, r.id DESC`
    )
    .all();
  const listed = new Set(entries.map((e) => e.product_variant_id));
  const negatives = db
    .prepare(
      `SELECT pv.id AS product_variant_id, p.id AS product_id, p.name AS product_name, pv.variant_name, pv.stock_qty, p.needs_review
       FROM product_variants pv JOIN products p ON p.id = pv.product_id
       WHERE pv.stock_qty < 0 AND pv.is_active = 1 AND p.is_active = 1
       ORDER BY pv.stock_qty`
    )
    .all()
    .filter((r) => !listed.has(r.product_variant_id));
  return { success: true, entries, belowZero: negatives, count: entries.length + negatives.length };
}

function resolveRecount({ id, userId } = {}) {
  const db = getDb();
  const row = db.prepare('SELECT id, resolved_at FROM stock_recount WHERE id = ?').get(id);
  if (!row) return { success: false, reason: 'That entry no longer exists.' };
  if (row.resolved_at) return { success: true };
  db.prepare("UPDATE stock_recount SET resolved_at = datetime('now'), resolved_by = ? WHERE id = ?").run(userId || null, id);
  return { success: true };
}

function registerApprovalsIpc() {
  ipcMain.handle('approvals:request', (event, payload) => requestApproval(event, payload || {}));
  ipcMain.handle('approvals:list', (event, payload) => listApprovals(payload || {}));
  ipcMain.handle('stock:list-recount', () => listRecount());
  ipcMain.handle('stock:resolve-recount', (event, payload) => resolveRecount({ ...(payload || {}), userId: getCaller(event)?.userId }));
}

module.exports = { registerApprovalsIpc, listRecount };
