import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Select, Button, Banner, tableStyles } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Admin-only, same rule as the rest of the Suppliers module. Supersedes the
// earlier stub — this now writes the full purchases/purchase_items record,
// not just stock_movements.
export default function PurchaseEntry() {
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [lines, setLines] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    window.api.suppliers.list().then((rows) => setSuppliers(rows.filter((r) => r.is_active)));
  }, []);

  function handleQueryChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  }

  async function runSearch(value) {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const res = await window.api.sales.searchProducts({ query: value.trim() });
    setResults(res);
  }

  async function addVariant(variantId) {
    const detail = await window.api.sales.getVariantForCart({ variantId });
    if (!detail || !detail.defaultUnitId) {
      setError('This item has no selling unit configured.');
      return;
    }
    const unitId = detail.defaultUnitId;
    const unit = detail.units.find((u) => u.id === unitId);

    setLines((prev) => [
      ...prev,
      {
        key: `${detail.variant.id}-${Date.now()}`,
        variantId: detail.variant.id,
        variantName: detail.variant.variantName,
        productName: detail.product.name,
        units: detail.units,
        unitId,
        conversionFactor: unit.conversionFactor,
        quantity: 1,
        unitCost: unit.costPrice,
      },
    ]);
    setQuery('');
    setResults([]);
  }

  function updateLineUnit(key, newUnitId) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const unit = l.units.find((u) => u.id === newUnitId);
        return { ...l, unitId: newUnitId, conversionFactor: unit.conversionFactor, unitCost: unit.costPrice };
      })
    );
  }

  function updateLineField(key, field, value) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }

  function removeLine(key) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function resetForm() {
    setSupplierId('');
    setReferenceNo('');
    setLines([]);
    setQuery('');
    setResults([]);
    setError('');
  }

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function handleComplete() {
    setError('');
    if (!supplierId) return setError('Select a supplier.');
    if (lines.length === 0) return setError('Add at least one line item.');
    for (const l of lines) {
      if (!Number(l.quantity) || Number(l.quantity) <= 0) return setError(`Enter a valid quantity for ${l.productName}.`);
      if (l.unitCost === '' || Number(l.unitCost) < 0) return setError(`Enter a valid unit cost for ${l.productName}.`);
    }

    setCompleting(true);
    const res = await window.api.purchases.create({
      supplierId: Number(supplierId),
      referenceNo: referenceNo.trim() || null,
      items: lines.map((l) => ({
        productVariantId: l.variantId,
        productUnitId: l.unitId,
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost),
      })),
      createdBy: user.id,
    });
    setCompleting(false);

    if (!res.success) {
      setError(res.reason || 'Could not complete purchase.');
      return;
    }
    setSuccessMessage(`Purchase recorded — total ${formatCurrency(round2(subtotal))}.`);
    resetForm();
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
      <PageHeader title="Purchase Entry" />

      {successMessage && (
        <div style={styles.successBanner}>
          {successMessage}
          <button style={styles.dismissBtn} onClick={() => setSuccessMessage('')}>
            ✕
          </button>
        </div>
      )}

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.headerFields}>
          <div style={{ flex: 1 }}>
            <Label>Supplier</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Select a supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Label>Reference No (optional)</Label>
            <TextInput value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Supplier's invoice number" />
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: theme.spacing.md, position: 'relative' }}>
        <Label>Add Product</Label>
        <TextInput placeholder="Search by name, SKU or barcode…" value={query} onChange={(e) => handleQueryChange(e.target.value)} />
        {results.length > 0 && (
          <div style={styles.resultsDropdown}>
            {results.map((r) => (
              <div
                key={r.variantId}
                style={styles.resultRow}
                onClick={() => addVariant(r.variantId)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>
                  {r.productName}
                  {r.variantName !== 'Standard' ? ` — ${r.variantName}` : ''}
                </div>
                <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs }}>{r.sku || '—'}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: 0, marginBottom: theme.spacing.md }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Product</th>
                <th style={tableStyles.th}>Unit</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Quantity</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Unit Cost</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Line Total</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td style={tableStyles.td}>
                    {l.productName}
                    {l.variantName !== 'Standard' ? ` — ${l.variantName}` : ''}
                  </td>
                  <td style={tableStyles.td}>
                    <Select value={l.unitId} onChange={(e) => updateLineUnit(l.key, Number(e.target.value))} style={{ minWidth: '110px' }}>
                      {l.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.unitName}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                    <input
                      type="number"
                      value={l.quantity}
                      onChange={(e) => updateLineField(l.key, 'quantity', e.target.value)}
                      style={styles.numberInput}
                    />
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                    <input
                      type="number"
                      value={l.unitCost}
                      onChange={(e) => updateLineField(l.key, 'unitCost', e.target.value)}
                      style={styles.numberInput}
                    />
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                    {formatCurrency(round2((Number(l.quantity) || 0) * (Number(l.unitCost) || 0)))}
                  </td>
                  <td style={tableStyles.td}>
                    <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => removeLine(l.key)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={6} style={tableStyles.emptyState}>
                    Search for a product above to add a line.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card style={{ maxWidth: '360px' }}>
        <div style={styles.totalRow}>
          <span style={{ color: theme.colors.textSecondary }}>Subtotal</span>
          <span style={{ fontWeight: theme.font.weightSemibold }}>{formatCurrency(round2(subtotal))}</span>
        </div>
        <div style={{ ...styles.totalRow, borderTop: `1px solid ${theme.colors.border}`, paddingTop: '8px', marginTop: '8px' }}>
          <span style={{ color: theme.colors.textPrimary, fontWeight: theme.font.weightSemibold }}>Total</span>
          <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold }}>
            {formatCurrency(round2(subtotal))}
          </span>
        </div>

        <Banner>{error}</Banner>

        <Button onClick={handleComplete} disabled={completing} style={{ width: '100%', marginTop: theme.spacing.md }}>
          {completing ? 'Saving…' : 'Complete Purchase'}
        </Button>
      </Card>
    </div>
  );
}

const styles = {
  headerFields: { display: 'flex', gap: theme.spacing.md },
  resultsDropdown: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    marginTop: '4px',
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    maxHeight: '240px',
    overflowY: 'auto',
    zIndex: 20,
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
    color: theme.colors.textPrimary,
    transition: 'background-color 0.15s ease',
  },
  numberInput: {
    width: '90px',
    padding: '6px 8px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    textAlign: 'right',
    fontSize: theme.font.sizeSm,
  },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  successBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.successBackground,
    color: theme.colors.success,
    border: `1px solid ${theme.colors.success}`,
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.font.sizeSm,
  },
  dismissBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.font.sizeBase, color: theme.colors.success },
};
