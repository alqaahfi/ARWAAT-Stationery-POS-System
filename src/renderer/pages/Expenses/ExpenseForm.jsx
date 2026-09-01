import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Label, TextInput, Select, Banner } from '../../components/ui';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Route: /expenses/new (no expenseId) and /expenses/edit (expenseId from the
// All Expenses list's Edit action) — same form either way.
export default function ExpenseForm({ expenseId, onDone, onCancel }) {
  const { user } = useAuth();

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!expenseId);

  useEffect(() => {
    window.api.expenseCategories.list().then(setCategories);
  }, []);

  useEffect(() => {
    if (!expenseId) return;
    window.api.expenses.getById({ id: expenseId }).then((row) => {
      if (row) {
        setDescription(row.description);
        setAmount(String(row.amount));
        setCategoryId(row.category_id || '');
        setExpenseDate((row.expense_date || '').slice(0, 10) || todayIso());
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
      categoryId: categoryId ? Number(categoryId) : null,
      expenseDate,
    };
    const res = expenseId
      ? await window.api.expenses.update({ id: expenseId, ...payload })
      : await window.api.expenses.create({ ...payload, paidBy: user.id });
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

        <Label>Amount</Label>
        <TextInput type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />

        <Label>Category (optional)</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Label>Date</Label>
        <TextInput type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />

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
