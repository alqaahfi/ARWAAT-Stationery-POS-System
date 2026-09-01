import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, tableStyles, Tr, Label, TextInput, Select, TextArea, Banner, HelperText } from '../../components/ui';
import { formatCount, formatDateTime } from '../../utils/format';

// Route: /products/stock-adjustments. Manual +/- correction to a single
// variant's stock — the one path (besides purchases and sales) allowed to
// touch stock_qty directly. Every save writes a stock_movements row too, so
// it immediately shows up in Movement History.
//
// Accepts an optional productId (the All Products page's "Adjust Stock"
// action pre-fills it) — when present, skips the product picker and loads
// that product directly.
export default function StockAdjustment({ productId }) {
  const { user } = useAuth();

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(!!productId);
  const [reasons, setReasons] = useState([]);

  useEffect(() => {
    window.api.stock.getAdjustmentReasons().then(setReasons);
  }, []);

  useEffect(() => {
    if (!productId) return;
    setLoadingProduct(true);
    window.api.products.getById({ id: productId }).then((p) => {
      setProduct(p);
      setLoadingProduct(false);
    });
  }, [productId]);

  return (
    <div>
      <PageHeader title="Stock Adjustments" />

      {!product && !loadingProduct && <ProductPicker onSelect={setProduct} />}
      {loadingProduct && <Card>Loading…</Card>}

      {product && (
        <AdjustmentWorkspace
          key={product.id}
          product={product}
          reasons={reasons}
          userId={user.id}
          onChangeProduct={productId ? null : () => setProduct(null)}
          onProductRefresh={(fresh) => setProduct(fresh)}
        />
      )}
    </div>
  );
}

function ProductPicker({ onSelect }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  function handleSearch(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const data = await window.api.products.list({ search: value.trim(), activeFilter: 'active' });
      setResults(data.rows);
      setLoading(false);
    }, 250);
  }

  async function selectRow(row) {
    const full = await window.api.products.getById({ id: row.id });
    onSelect(full);
  }

  return (
    <Card style={{ marginBottom: theme.spacing.md }}>
      <Label>Search Product</Label>
      <TextInput placeholder="Search name or SKU…" value={search} onChange={(e) => handleSearch(e.target.value)} autoFocus />
      {loading && <HelperText>Searching…</HelperText>}
      {results.length > 0 && (
        <div style={tableStyles.scroll}>
          <table style={{ ...tableStyles.table, marginTop: theme.spacing.sm }}>
            <tbody>
              {results.map((r) => (
                <Tr key={r.id} onClick={() => selectRow(r)}>
                  <td style={tableStyles.td}>{r.name}</td>
                  <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{r.category_name || '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                    {formatCount(r.total_stock)} {r.base_unit_name}
                  </td>
                </Tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && search.trim() && results.length === 0 && <HelperText>No matching products.</HelperText>}
    </Card>
  );
}

function AdjustmentWorkspace({ product, reasons, userId, onChangeProduct, onProductRefresh }) {
  const variants = product.variants || [];
  const [variantId, setVariantId] = useState(variants.length === 1 ? variants[0].id : null);
  const [direction, setDirection] = useState('increase');
  const [quantity, setQuantity] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  useEffect(() => {
    loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id]);

  async function loadRecent() {
    setLoadingRecent(true);
    const res = await window.api.stock.getMovements({ productId: product.id, movementType: 'adjustment' });
    setRecent(res.rows);
    setLoadingRecent(false);
  }

  const selectedVariant = variants.find((v) => v.id === variantId);

  async function handleSave() {
    setError('');
    setSuccess('');
    if (!variantId) return setError('Select which variant to adjust.');
    const qty = Number(quantity);
    if (!qty || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (!reasonCode) return setError('Select a reason.');

    setSaving(true);
    const res = await window.api.stock.adjust({
      productVariantId: variantId,
      direction,
      quantity: qty,
      reasonCode,
      note: note.trim() || null,
      createdBy: userId,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save adjustment.');
      return;
    }

    setSuccess(`Saved — ${selectedVariant.variant_name} is now ${formatCount(res.newStock)} ${product.base_unit_name}.`);
    setQuantity('');
    setNote('');
    setReasonCode('');
    loadRecent();

    const fresh = await window.api.products.getById({ id: product.id });
    onProductRefresh(fresh);
  }

  return (
    <>
      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.productName}>{product.name}</div>
            {product.sku && <div style={styles.productMeta}>SKU: {product.sku}</div>}
          </div>
          {onChangeProduct && (
            <Button variant="ghost" onClick={onChangeProduct}>
              Change Product
            </Button>
          )}
        </div>

        <Label>Variant</Label>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}></th>
                <th style={tableStyles.th}>Variant</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Current Stock</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <Tr key={v.id} onClick={() => setVariantId(v.id)} style={variantId === v.id ? styles.variantRowActive : undefined}>
                  <td style={{ ...tableStyles.td, width: '28px' }}>
                    <input type="radio" checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                  </td>
                  <td style={tableStyles.td}>{v.variant_name}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                    {formatCount(v.stock_qty)} {product.base_unit_name}
                  </td>
                </Tr>
              ))}
              {variants.length === 0 && (
                <tr>
                  <td colSpan={3} style={tableStyles.emptyState}>
                    This product has no active variants.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Label>Adjustment</Label>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <Button variant={direction === 'increase' ? 'primary' : 'secondary'} onClick={() => setDirection('increase')} style={{ flex: 1 }}>
            + Increase
          </Button>
          <Button variant={direction === 'decrease' ? 'primary' : 'secondary'} onClick={() => setDirection('decrease')} style={{ flex: 1 }}>
            − Decrease
          </Button>
        </div>

        <Label>Quantity ({product.base_unit_name})</Label>
        <TextInput type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

        <Label>Reason</Label>
        <Select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          <option value="">Select a reason…</option>
          {reasons.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </Select>

        <Label>Note (optional)</Label>
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any extra detail worth recording" />

        <Banner>{error}</Banner>
        <Banner tone="info">{success}</Banner>

        <div style={{ marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving || variants.length === 0}>
            {saving ? 'Saving…' : 'Save Adjustment'}
          </Button>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={styles.recentHeader}>Recent Adjustments — {product.name}</div>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Variant</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Change</th>
                <th style={tableStyles.th}>Reason</th>
                <th style={tableStyles.th}>By</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                  <Tr key={r.id}>
                    <td style={tableStyles.td}>{formatDateTime(r.created_at)}</td>
                    <td style={tableStyles.td}>{r.variant_name}</td>
                    <td
                      style={{
                        ...tableStyles.td,
                        textAlign: 'right',
                        fontWeight: theme.font.weightMedium,
                        color: r.quantity > 0 ? theme.colors.success : theme.colors.danger,
                      }}
                    >
                      {r.quantity > 0 ? '+' : ''}
                      {formatCount(r.quantity)}
                    </td>
                    <td style={tableStyles.td}>{r.note}</td>
                    <td style={tableStyles.td}>{r.created_by_name || '—'}</td>
                  </Tr>
                ))}
              {!loadingRecent && recent.length === 0 && (
                <tr>
                  <td colSpan={5} style={tableStyles.emptyState}>
                    No adjustments recorded yet for this product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const styles = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.sm },
  productName: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary },
  productMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, marginTop: '2px' },
  variantRowActive: { backgroundColor: theme.colors.infoBackground },
  recentHeader: {
    padding: '12px 14px',
    fontWeight: theme.font.weightSemibold,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
};
