import glossary from '../../../config/glossary';

// Repeat values as stored (see utils/expenseRecurrence.js), in plain words.
export const REPEAT_VALUES = ['daily', 'weekly', 'monthly', 'annually'];
export const REPEAT_CHOICES = REPEAT_VALUES.map((value) => ({ value, label: glossary.repeatEvery[value] }));

export const TYPE_FILTERS = [{ value: '', label: 'All' }, { value: 'one_time', label: glossary.justOnce }, ...REPEAT_CHOICES];

export function repeatLabel(recurrence) {
  return glossary.repeatEvery[recurrence] || null;
}

// expense_date is a calendar date ("YYYY-MM-DD 00:00:00"), read as local.
function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function dayText(value) {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function weekdayText(value) {
  const d = parseDay(value);
  return d ? d.toLocaleDateString('en-US', { weekday: 'long' }) : '';
}
