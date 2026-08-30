import { formatCurrencyExact, formatDateTime, formatDateOnly, formatCount } from '../../../utils/format';

// Single dispatcher so a report's `columns` definition (format: 'currency' |
// 'date' | 'dateOnly' | 'number' | 'text') renders identically in the
// interactive table, the print view, and nowhere needs its own copy of this
// switch statement.
export function formatCell(value, format) {
  if (value === null || value === undefined || value === '') return '—';
  switch (format) {
    case 'currency':
      return formatCurrencyExact(value);
    case 'date':
      return formatDateTime(value);
    case 'dateOnly':
      return formatDateOnly(value);
    case 'number':
      return formatCount(value);
    default:
      return String(value);
  }
}
