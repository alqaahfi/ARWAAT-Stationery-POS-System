import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Banner, Button, Card, Skeleton, useToast } from '../../components/ui';
import { formatCount } from '../../utils/format';
import { StockIntro, LoadError } from './stock/StockIntro';
import { ItemPicker } from './stock/ItemPicker';
import { SelectedItem, ReasonChips, AmountFields } from './stock/AdjustParts';

// Same product search the page has always used (products:list).
async function searchProducts(query) {
  const data = await window.api.products.list({ search: query, activeFilter: 'active' });
  return data.rows;
}
const mapResult = (r) => ({
  key: r.id,
  title: r.name,
  subtitle: [r.sku, r.category_name].filter(Boolean).join(' · '),
  stock: `${formatCount(r.total_stock)} ${r.base_unit_name || ''}`,
});

// Route: /products/stock-adjustments. Manual +/- correction to a single
// variant's stock — the one path (besides purchases and sales) allowed to
// touch stock_qty directly. Every save writes a stock_movements row too, so
// it immediately shows up in Stock History.
//
// Accepts an optional productId (the All Products page's "Fix Stock Count"
// action pre-fills it) — when present, starts with that product selected.
export default function StockAdjustment({ productId }) {
  const { user } = useAuth();
  const toast = useToast();

  const [product, setProduct] = useState(null);
  const [loadingProduct, setLoadingProduct] = useState(!!productId);
  const [productError, setProductError] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [reasonsError, setReasonsError] = useState(false);

  const [variantId, setVariantId] = useState(null);
  const [direction, setDirection] = useState('increase');
  const [quantity, setQuantity] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReasons = useCallback(async () => {
    setReasonsError(false);
    try {
      setReasons(await window.api.stock.getAdjustmentReasons());
    } catch {
      setReasonsError(true);
    }
  }, []);

  useEffect(() => {
    loadReasons();
  }, [loadReasons]);

  function chooseProduct(p) {
    setProduct(p);
    const variants = p?.variants || [];
    setVariantId(variants.length === 1 ? variants[0].id : null);
    setDirection('increase');
    setQuantity('');
    setReasonCode('');
    setNote('');
    setError('');
  }

  const loadProduct = useCallback(async (id) => {
    setLoadingProduct(true);
    setProductError(false);
    try {
      chooseProduct(await window.api.products.getById({ id }));
    } catch {
      setProductError(true);
    }
    setLoadingProduct(false);
  }, []);

  useEffect(() => {
    if (productId) loadProduct(productId);
  }, [productId, loadProduct]);

  const variants = product?.variants || [];
  const selectedVariant = variants.find((v) => v.id === variantId);
  const qty = Number(quantity);
  const current = selectedVariant ? Number(selectedVariant.stock_qty) || 0 : null;
  const overLimit =
    selectedVariant && direction === 'decrease' && qty > current
      ? `Cannot remove ${qty} — only ${selectedVariant.stock_qty} currently in stock for ${product.name} (${selectedVariant.variant_name}).`
      : '';
  const canSave = !!variantId && qty > 0 && !!reasonCode && !overLimit;

  async function handleSave() {
    setError('');
    if (!variantId) return setError('Choose which Type to fix.');
    if (!qty || qty <= 0) return setError('Enter a quantity greater than zero.');
    if (!reasonCode) return setError('Select a reason.');
    if (overLimit || saving) return;

    setSaving(true);
    let res;
    try {
      res = await window.api.stock.adjust({
        productVariantId: variantId,
        direction,
        quantity: qty,
        reasonCode,
        note: note.trim() || null,
        createdBy: user.id,
      });
    } catch {
      res = { success: false };
    }
    setSaving(false);

    if (!res.success) {
      const msg = res.reason || 'Could not save adjustment.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const typeName = selectedVariant.variant_name !== 'Standard' ? ` (${selectedVariant.variant_name})` : '';
    toast.success(`Stock updated — ${product.name}${typeName} now has ${formatCount(res.newStock)} ${product.base_unit_name}`);
    chooseProduct(null);
  }

  return (
    <div style={{ maxWidth: '640px', paddingBottom: theme.spacing.xxl }}>
      <StockIntro>Use this when your real stock doesn't match the app — for damaged, expired or lost items, or after a recount.</StockIntro>

      <Card title="Which item?" style={{ marginBottom: theme.spacing.md }}>
        {loadingProduct ? (
          <Skeleton lines={2} />
        ) : productError ? (
          <LoadError message="This item couldn't be loaded." onRetry={() => loadProduct(productId)} />
        ) : product ? (
          <SelectedItem product={product} variantId={variantId} onVariant={setVariantId} onChange={() => chooseProduct(null)} />
        ) : (
          <ItemPicker
            id="adjust-item-search"
            autoFocus
            placeholder="Type a name or item code"
            search={searchProducts}
            mapResult={mapResult}
            onPick={async (row) => {
              try {
                chooseProduct(await window.api.products.getById({ id: row.id }));
              } catch {
                toast.error("That item couldn't be loaded. Try again.");
              }
            }}
            debounceMs={250}
          />
        )}
      </Card>

      {product && (
        <>
          <Card title="What happened?" style={{ marginBottom: theme.spacing.md }}>
            {reasonsError ? <LoadError onRetry={loadReasons} /> : <ReasonChips reasons={reasons} value={reasonCode} onChange={setReasonCode} />}
          </Card>

          <Card title="How much?" style={{ marginBottom: theme.spacing.md }}>
            <AmountFields
              direction={direction}
              onDirection={setDirection}
              quantity={quantity}
              onQuantity={setQuantity}
              unitName={product.base_unit_name}
              current={current}
              overLimit={overLimit}
              note={note}
              onNote={setNote}
              onSubmit={() => canSave && !saving && handleSave()}
            />
          </Card>

          {error && <Banner style={{ marginBottom: theme.spacing.md }}>{error}</Banner>}

          <Button size="lg" onClick={handleSave} disabled={!canSave} loading={saving}>
            Save
          </Button>
        </>
      )}
    </div>
  );
}
