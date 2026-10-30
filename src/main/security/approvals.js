// Rule 12: one-time Admin approvals for the cashier screen.
//
// The cashier's window asks (approvals:request) with the Admin's username and
// password; a correct one gives a short-lived token bound to THAT window's
// signed-in user. The next sales:create / sales:update / sales:void from that
// user may present it: the handler checks it (peek), does the work, writes the
// approvals log row(s) and only then uses it up (consume) — so an approval is
// spent only on a save that really happened, and never by anyone else.
const crypto = require('crypto');

const TTL_MS = 3 * 60 * 1000;
const tokens = new Map(); // token -> { callerId, adminId, adminName, expiresAt }

function prune() {
  const now = Date.now();
  for (const [k, v] of tokens) if (v.expiresAt <= now) tokens.delete(k);
}

function issueApproval({ callerId, adminId, adminName }) {
  prune();
  const token = crypto.randomBytes(16).toString('hex');
  tokens.set(token, { callerId, adminId, adminName, expiresAt: Date.now() + TTL_MS });
  return token;
}

// The approving Admin's id, or null when the token is missing/expired/someone else's.
function peekApproval(token, callerId) {
  if (!token) return null;
  prune();
  const entry = tokens.get(token);
  if (!entry || entry.callerId !== callerId) return null;
  return entry.adminId;
}

function consumeApproval(token) {
  if (token) tokens.delete(token);
}

module.exports = { issueApproval, peekApproval, consumeApproval, TTL_MS };
