export function formatCount(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// Auto-compact currency for stat tiles: plain with thousands separators up to
// 100K, then K/M so a tile value never runs long. Detail tables (once built)
// should show the exact amount instead.
export function formatCurrency(n) {
  const value = Number(n || 0);
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);

  if (abs >= 1_000_000) return `Rs ${(rounded / 1_000_000).toFixed(1)}M`;
  if (abs >= 100_000) return `Rs ${(rounded / 1_000).toFixed(1)}K`;
  return `Rs ${rounded.toLocaleString('en-US')}`;
}

// Exact currency for report tables / CSV-adjacent display — the compact K/M
// form above is meant for stat tiles, not a row a shop owner is reconciling.
export function formatCurrencyExact(n) {
  const value = Number(n || 0);
  return `Rs ${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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
