import glossary from '../../../../config/glossary';

export const REASON_OPTIONS = ['wrong_item', 'faulty', 'changed_mind', 'other'].map((value) => ({
  value,
  label: glossary.returnReason[value],
}));

export const reasonLabel = (reason) => glossary.returnReason[reason] || reason || '—';

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// "Type · Pack size" footnote under an item name.
export const packLine = (line) => [line.variant_name, line.unit_name].filter(Boolean).join(' · ');

export const formatQty = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 3 });

// Same rules as the POS quantity field — plain decimal number, nothing else —
// and never more than can still be returned.
export function cleanQty(raw, max) {
  let text = String(raw).replace(/[^0-9.]/g, '');
  const dot = text.indexOf('.');
  if (dot !== -1) text = text.slice(0, dot + 1) + text.slice(dot + 1).replace(/\./g, '');
  if (text !== '' && Number(text) > max) return String(max);
  return text;
}

// Live preview only — the server works the real figures out again. When every
// remaining quantity is selected the return is worth exactly what's left.
export function previewTotal(lines, qty, remainingValue) {
  let sum = 0;
  let any = false;
  let everything = true;
  for (const l of lines) {
    const q = Number(qty[l.sale_item_id]) || 0;
    if (q > 0) any = true;
    if (l.returnable > 0 && Math.abs(q - l.returnable) > 0.0001) everything = false;
    sum += round2(q * l.unit_refund_value);
  }
  if (any && everything) return round2(remainingValue);
  return round2(sum);
}

// Cash can only go back for the part of the return beyond what they owe.
export const cashCap = (total, balance) => round2(Math.min(total, Math.max(0, total - (Number(balance) || 0))));
