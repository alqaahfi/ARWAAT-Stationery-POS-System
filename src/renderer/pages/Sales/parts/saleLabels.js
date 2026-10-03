import glossary from '../../../config/glossary';

// Payment status as it was AT THE TIME OF SALE — later payments go on the
// customer's account and never change these.
export const STATUS = {
  paid: { label: glossary.paid, tone: 'green' },
  partial: { label: glossary.partlyPaid, tone: 'orange' },
  unpaid: { label: glossary.notPaid, tone: 'orange' },
};

// Only the states worth a badge — 'none' has none.
export const RETURN_STATUS = { partial: glossary.partlyReturned, full: glossary.returned };

export const SALE_TYPE = {
  retail: { label: glossary.retail, tone: 'blue' },
  wholesale: { label: glossary.wholesale, tone: 'purple' },
};

// Full local date + time (with year) for a UTC 'YYYY-MM-DD HH:MM:SS' string.
export function formatLocalDateTime(utc) {
  if (!utc) return '—';
  const date = new Date(`${utc.replace(' ', 'T')}${utc.endsWith('Z') ? '' : 'Z'}`);
  if (Number.isNaN(date.getTime())) return utc;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
