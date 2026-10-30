export function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// Shop currency symbol (Settings → Preferences). Read once at startup and
// refreshed when Preferences is saved; "Rs" until/unless a value is stored.
let currencySymbol = 'Rs';

export function setCurrencySymbol(value) {
  const next = typeof value === 'string' ? value.trim() : '';
  currencySymbol = next || 'Rs';
}

export async function loadCurrencySymbol() {
  try {
    const all = await window.api?.settings?.getAll?.();
    setCurrencySymbol(all?.currency_symbol);
  } catch {
    /* keep the fallback */
  }
}

// Rule 10: no rounding of totals. Money on bills, carts, payments and lists is
// shown exactly as stored: thousands separators, paisa only when there are any
// (Rs 1,250 / Rs 93.75 / Rs 125,000).
export function formatCurrency(n) {
  const value = Math.round((Number(n) || 0) * 100) / 100;
  const decimals = Number.isInteger(value) ? 0 : 2;
  return `${currencySymbol} ${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// Auto-compact currency for stat tiles and chart axes only (Home, report
// summary cards): plain up to 100K, then K/M so a tile value never runs long.
export function formatCurrencyCompact(n) {
  const value = Number(n || 0);
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);

  if (abs >= 1_000_000) return `${currencySymbol} ${(rounded / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `${currencySymbol} ${(rounded / 1_000).toFixed(1)}K`;
  return `${currencySymbol} ${rounded.toLocaleString('en-US')}`;
}

// Exact currency for report tables / CSV-adjacent display — the compact K/M
// form above is meant for stat tiles, not a row a shop owner is reconciling.
export function formatCurrencyExact(n) {
  const value = Number(n || 0);
  return `${currencySymbol} ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatDateOnly(isoString) {
  if (!isoString) return '—';
  const raw = isoString.includes('T') ? isoString : isoString.replace(' ', 'T');
  const date = new Date(raw.endsWith('Z') ? raw : `${raw}Z`);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  // Stored as UTC ("datetime('now')"); render in the viewer's local time.
  const date = new Date(isoString.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
