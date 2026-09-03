import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Label, TextInput, Select, Banner } from '../../components/ui';
import { RECURRENCE_OPTIONS } from '../../utils/expenseRecurrence';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const RECURRENCE_PERIOD_NOUN = { daily: 'day', weekly: 'week', monthly: 'month', annually: 'year' };

// Route: /expenses/new (no expenseId) and /expenses/edit (expenseId from the
// All Expenses list's Edit action) — same form either way. Recurrence can
// only be chosen when creating: an existing occurrence's date/amount/payee
// can be corrected, but its recurring series is fixed once started (stop it
// from the All Expenses list instead of changing it here).
export default function ExpenseForm({ expenseId, onDone, onCancel }) {
  const { user } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [recurrence, setRecurrence] = useState('one_time');
  const [existingRecurrenceLabel, setExistingRecurrenceLabel] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!expenseId);

  useEffect(() => {
    if (!expenseId) return;
    window.api.expenses.getById({ id: expenseId }).then((row) => {
      if (row) {
        setDescription(row.description);
        setAmount(String(row.amount));
        setPayee(row.payee || '');
        setExpenseDate((row.expense_date || '').slice(0, 10) || todayIso());
        setRecurrence(row.recurrence || 'one_time');
        const opt = RECURRENCE_OPTIONS.find((o) => o.value === row.recurrence);
        setExistingRecurrenceLabel(opt ? opt.label : 'One-time');
      }
      setLoading(false);
    });
  }, [expenseId]);

  async function handleSave() {
    setError('');
    if (!description.trim()) return setError('Description is required.');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter an amount greater than zero.');

    setSaving(true);
    const payload = {
      description: description.trim(),
      amount: amt,
      payee: payee.trim() || null,
      expenseDate,
    };
    const res = expenseId
      ? await window.api.expenses.update({ id: expenseId, ...payload })
      : await window.api.expenses.create({ ...payload, recurrence, paidBy: user.id });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save expense.');
      return;
    }
    onDone();
  }

  if (loading) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title={expenseId ? 'Edit Expense' : 'Add Expense'} />

      <Card style={{ maxWidth: '520px' }}>
        <Label>Description</Label>
        <TextInput
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Electricity bill for August"
          autoFocus
        />

        <Label>Payee (optional)</Label>
        <TextInput value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. K-Electric" />

        <Label>Amount</Label>
        <TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <Label>{expenseId ? 'Date' : 'Date (first occurrence, if recurring)'}</Label>
        <TextInput type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />

        <Label>Recurrence</Label>
        {expenseId ? (
          <TextInput value={existingRecurrenceLabel} disabled />
        ) : (
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        {!expenseId && recurrence !== 'one_time' && (
          <div style={styles.hint}>
            An expense will be recorded automatically on this date, and again every {RECURRENCE_PERIOD_NOUN[recurrence]}{' '}
            after it, until you stop the recurrence from the All Expenses list.
          </div>
        )}

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Expense'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  hint: { marginTop: '6px', fontSize: theme.font.sizeXs, color: theme.colors.textSecondary },
};
