// Renderer-side copy of src/shared/expenseRecurrence.js's enum — kept
// separate because that file is plain CommonJS for main's require() (see its
// header comment), and this list is small/stable enough that duplicating it
// beats plumbing a CJS module through the Vite bundle.
export const RECURRENCE_OPTIONS = [
  { value: 'one_time', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annually', label: 'Annually' },
];

export const RECURRENCE_LABELS = RECURRENCE_OPTIONS.reduce((acc, o) => {
  acc[o.value] = o.label;
  return acc;
}, {});
