import React, { useEffect, useState } from 'react';
import { Card, PageHeader, Button, Label, TextInput, Select, Banner, tableStyles, Tr } from '../../components/ui';
import theme from '../../config/theme';

const emptyForm = { id: null, name: '', parentId: '' };

export default function CategoryList() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(null); // null = form hidden
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    window.api.categories.list().then((res) => {
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
    setForm({ id: cat.id, name: cat.name, parentId: cat.parent_id || '' });
  }

  async function handleSave() {
    setError('');
    const payload = { name: form.name, parentId: form.parentId ? Number(form.parentId) : null };
    const res = form.id
      ? await window.api.categories.update({ id: form.id, ...payload })
      : await window.api.categories.create(payload);
    if (!res.success) {
      setError(res.reason || 'Could not save category.');
      return;
    }
    setForm(null);
    load();
  }

  async function handleDelete(cat) {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    const res = await window.api.categories.delete({ id: cat.id });
    if (!res.success) {
      setError(res.reason || 'Could not delete category.');
      return;
    }
    load();
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        actions={!form && <Button onClick={startAdd}>+ Add Category</Button>}
      />

      {form && (
        <Card style={{ marginBottom: '18px' }}>
          <Label>Category Name</Label>
          <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />

          <Label>Parent Category (optional)</Label>
          <Select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })}>
            <option value="">No parent</option>
            {categories
              .filter((c) => c.id !== form.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>

          <Banner>{error}</Banner>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
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
          <div style={tableStyles.emptyState}>No categories yet.</div>
        ) : (
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Name</th>
                  <th style={tableStyles.th}>Parent</th>
                  <th style={tableStyles.th}>Products</th>
                  <th style={tableStyles.th}></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <Tr key={cat.id}>
                    <td style={tableStyles.td}>{cat.name}</td>
                    <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{cat.parent_name || '—'}</td>
                    <td style={tableStyles.td}>{cat.product_count}</td>
                    <td style={{ ...tableStyles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button variant="ghost" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => startEdit(cat)}>
                        Edit
                      </Button>{' '}
                      <Button
                        variant="ghost"
                        style={{ padding: '6px 12px', fontSize: '12px', color: theme.colors.danger }}
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
