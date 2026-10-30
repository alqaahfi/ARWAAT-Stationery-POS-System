// Rule 3: every quantity the shop types (sale, free/FOC, return, purchase,
// stock add/remove/fix, starting stock, quick-add) is a positive whole number.
// The screens refuse decimals as they are typed; this is the server-side check.
const WHOLE_QTY_MSG = 'Quantities must be whole numbers like 1, 2, 3 (no decimals).';
const MAX_QTY = 1e6;

// The number, or null when it is not a whole number in range.
function wholeQty(value, { allowZero = false } = {}) {
  if (value === null || value === undefined || value === '') return allowZero ? 0 : null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (allowZero ? n < 0 : n <= 0) return null;
  if (n > MAX_QTY) return null;
  return n;
}

module.exports = { wholeQty, WHOLE_QTY_MSG, MAX_QTY };
