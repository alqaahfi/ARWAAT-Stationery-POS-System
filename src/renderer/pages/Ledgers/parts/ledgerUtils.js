// Small display helpers shared by the Accounts pages.

// Same route + params the Customer/Supplier lists and profiles use.
export function openAccount(onNavigate, partyType, id, name) {
  onNavigate(partyType === 'supplier' ? '/ledgers/suppliers' : '/ledgers/customers', { id, name });
}

// Stored dates are UTC "YYYY-MM-DD HH:MM:SS" (or a bare "YYYY-MM-DD").
export function parseDbDate(value) {
  if (!value) return null;
  const raw = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(raw.endsWith('Z') || raw.length === 10 ? raw : `${raw}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTime(value) {
  const date = parseDbDate(value);
  if (!date || value.length === 10) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function monthLabel(value) {
  const date = parseDbDate(value);
  return date ? date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Unknown date';
}

const METHODS = { cash: 'Cash', bank: 'Bank', other: 'Other' };
export function methodLabel(method) {
  return METHODS[method] || (method ? String(method)[0].toUpperCase() + String(method).slice(1) : '—');
}

export const METHOD_OPTIONS = Object.entries(METHODS).map(([value, label]) => ({ value, label }));
