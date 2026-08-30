import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, TextArea, Select, Button, Banner, tableStyles, Tr } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

export default function CategoryManager() {
  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [priceRows, setPriceRows] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (!selectedCategoryId) {
      setPriceRows([]);
      return;
    }
    window.api.categoryPrices.getForCategory({ categoryId: Number(selectedCategoryId) }).then(setPriceRows);
  }, [selectedCategoryId]);

  async function loadCategories() {
    const rows = await window.api.customerCategories.list();
    setCategories(rows);
  }

  function startEdit(c) {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description || '');
    setError('');
  }

  function startNew() {
    setEditingId('new');
    setName('');
    setDescription('');
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setName('');
    setDescription('');
    setError('');
  }

  async function saveCategory() {
    if (!name.trim()) return setError('Category name is required.');
    const res =
      editingId === 'new'
        ? await window.api.customerCategories.create({ name: name.trim(), description: description.trim() || null })
        : await window.api.customerCategories.update({ id: editingId, name: name.trim(), description: description.trim() || null });

    if (!res.success) return setError(res.reason || 'Could not save category.');
    cancelEdit();
    loadCategories();
  }

  async function deleteCategory(c) {
    const res = await window.api.customerCategories.delete({ id: c.id });
    if (!res.success) {
      setError(res.reason);
      return;
    }
    if (String(selectedCategoryId) === String(c.id)) setSelectedCategoryId('');
    loadCategories();
  }

  function toggleExpand(productId) {
    setExpanded((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Customer Categories (Net Rate)" />

      <Card style={{ marginBottom: theme.spacing.lg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Categories</h4>
          {editingId === null && <Button onClick={startNew}>+ Add Category</Button>}
        </div>

        {editingId !== null && (
          <div style={{ marginTop: theme.spacing.md, maxWidth: '440px' }}>
            <Label>Name</Label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Label>Description (optional)</Label>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
            <Banner>{error}</Banner>
            <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <Button onClick={saveCategory}>Save</Button>
              <Button variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div style={{ ...tableStyles.scroll, marginTop: theme.spacing.md }}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>Description</th>
                <th style={tableStyles.th}>Customers</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((c) => (
                <Tr key={c.id}>
                  <td style={tableStyles.td}>{c.name}</td>
                  <td style={tableStyles.td}>{c.description || '—'}</td>
                  <td style={tableStyles.td}>{c.customer_count}</td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => startEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="danger" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => deleteCategory(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </Tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} style={tableStyles.emptyState}>
                    No customer categories yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Net-Rate Price Matrix</h4>
        <div style={{ maxWidth: '320px', marginTop: theme.spacing.sm }}>
          <Select value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)}>
            <option value="">Select a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        {selectedCategoryId && (
          <div style={{ ...tableStyles.scroll, marginTop: theme.spacing.md }}>
            <table style={tableStyles.table}>
              <thead>
                <tr>
                  <th style={tableStyles.th}>Product</th>
                  <th style={tableStyles.th}>Unit</th>
                  <th style={{ ...tableStyles.th, textAlign: 'right' }}>Default Price</th>
                  <th style={{ ...tableStyles.th, textAlign: 'right' }}>Price for this Category</th>
                </tr>
              </thead>
              <tbody>
                {priceRows.map((p) => (
                  <ProductPriceGroup
                    key={p.productId}
                    product={p}
                    categoryId={Number(selectedCategoryId)}
                    isExpanded={!!expanded[p.productId]}
                    onToggle={() => toggleExpand(p.productId)}
                  />
                ))}
                {priceRows.length === 0 && (
                  <tr>
                    <td colSpan={4} style={tableStyles.emptyState}>
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ProductPriceGroup({ product, categoryId, isExpanded, onToggle }) {
  return (
    <>
      <Tr onClick={onToggle}>
        <td style={{ ...tableStyles.td, fontWeight: theme.font.weightMedium }}>
          {isExpanded ? '▾' : '▸'} {product.productName}
        </td>
        <td style={tableStyles.td} colSpan={3}>
          {product.units.length} unit{product.units.length === 1 ? '' : 's'} — click to {isExpanded ? 'collapse' : 'expand'}
        </td>
      </Tr>
      {isExpanded &&
        product.units.map((u) => (
          <UnitPriceRow key={u.id} unit={u} categoryId={categoryId} />
        ))}
    </>
  );
}

function UnitPriceRow({ unit, categoryId }) {
  const [value, setValue] = useState(unit.overridePrice === null || unit.overridePrice === undefined ? '' : String(unit.overridePrice));
  const [status, setStatus] = useState(null); // null | 'saved' | 'unsaved'

  async function handleBlur() {
    if (status !== 'unsaved') return;
    const price = value.trim() === '' ? null : Number(value);
    await window.api.categoryPrices.upsert({ productUnitId: unit.id, customerCategoryId: categoryId, price });
    setStatus('saved');
  }

  return (
    <tr>
      <td style={tableStyles.td}></td>
      <td style={tableStyles.td}>{unit.unitName}</td>
      <td style={{ ...tableStyles.td, textAlign: 'right', color: theme.colors.textSecondary }}>{formatCurrency(unit.retailPrice)}</td>
      <td style={{ ...tableStyles.td, textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
          <input
            type="number"
            value={value}
            placeholder="No override"
            onChange={(e) => {
              setValue(e.target.value);
              setStatus('unsaved');
            }}
            onBlur={handleBlur}
            style={{
              width: '100px',
              padding: '6px 8px',
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.colors.border}`,
              textAlign: 'right',
              fontSize: theme.font.sizeSm,
            }}
          />
          {status === 'saved' && <span style={{ color: theme.colors.success, fontSize: theme.font.sizeXs }}>Saved</span>}
          {status === 'unsaved' && <span style={{ color: theme.colors.warning, fontSize: theme.font.sizeXs }}>Unsaved</span>}
        </div>
      </td>
    </tr>
  );
}
