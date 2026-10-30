// Rule 3: every quantity is a positive whole number. Quantity boxes pass what
// is typed (or pasted) through this, so a dot, minus sign, "e" or letters
// never get in. The main process checks again before saving.
export function wholeNumber(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function isWholeQty(value, { allowZero = false } = {}) {
  const n = Number(value);
  return Number.isInteger(n) && (allowZero ? n >= 0 : n > 0);
}
