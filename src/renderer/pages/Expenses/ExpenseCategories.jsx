import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, PageHeader, Button, Label, TextInput, Banner, tableStyles, Tr } from '../../components/ui';
import theme from '../../config/theme';

const emptyForm = { id: null, name: '' };

// Route: /expenses/categories.
export default function ExpenseCategories({ onNavigate }) {
  const { hasPermission } = useAuth();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null); // null = form hidden
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasPermission('manage_expenses')) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission]);

  function load() {
    setLoading(true);
    window.api.expenseCategories.list().then((res) => {
      setCategories(res);
      setLoading(false);
    });
  }

  function startAdd() {
    setError('');
    setForm({ ...emptyForm });
  }

  function startEdit(cat) {
    setError('');
    setForm({ id: cat.id, name: cat.name });
  }

  async function handleSave() {
    setError('');
    const res = form.id
      ? await window.api.expenseCategories.update({ id: form.id, name: form.name })
      : await window.api.expenseCategories.create({ name: form.name });
    if (!res.success) {
      setError(res.reason || 'Could not save category.');
      return;
    }
    setForm(null);
    load();
  }

  async function handleDelete(cat) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    const res = await window.api.expenseCategories.delete({ id: cat.id });
    if (!res.success) {
      setError(res.reason || 'Could not delete category.');
      return;
    }
    load();
  }

  if (!hasPermission('manage_expenses')) {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>You don't have permission to manage expenses</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Expense Categories"
        actions={
          <>
            <Button variant="ghost" onClick={() => onNavigate('/expenses')}>
              ← Back to Expenses
            </Button>
            {!form && <Button onClick={startAdd}>+ Add Category</Button>}
          </>
        }
      />

      {form && (
        <Card style={{ marginBottom: theme.spacing.md, maxWidth: '420px' }}>
          <Label>Category Name</Label>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />

          <Banner>{error}</Banner>

          <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <Button onClick={handleSave}>Save</Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {!form && <Banner>{error}</Banner>}

      <Card style={{ padding: 0 }}>
        {loading ? (
          <div style={tableStyles.emptyState}>Loading…</div>
        ) : categories.length === 0 ? (
          <div style={tableStyles.emptyState}>No expense categories yet.</div>
        ) : (
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Name</th>
                  <th style={tableStyles.th}>Expenses</th>
                  <th style={tableStyles.th}></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <Tr key={cat.id}>
                    <td style={tableStyles.td}>{cat.name}</td>
                    <td style={tableStyles.td}>{cat.expense_count}</td>
                    <td style={{ ...tableStyles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button variant="ghost" style={{ padding: '6px 12px', fontSize: theme.font.sizeXs }} onClick={() => startEdit(cat)}>
                        Edit
                      </Button>{' '}
                      <Button
                        variant="ghost"
                        style={{ padding: '6px 12px', fontSize: theme.font.sizeXs, color: theme.colors.danger }}
                        onClick={() => handleDelete(cat)}
                      >
                        Delete
                      </Button>
                    </td>
                  </Tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
