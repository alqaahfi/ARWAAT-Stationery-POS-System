import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Banner, Card, EmptyState, Skeleton, useConfirm, useToast } from '../../components/ui';
import { formatCount, formatCurrency } from '../../utils/format';
import { Lock } from 'lucide-react';
import { StockIntro, LoadError } from './stock/StockIntro';
import { PurchaseHeader } from './stock/PurchaseHeader';
import { PurchaseLines } from './stock/PurchaseLines';
import { PurchaseBar, PurchaseDone } from './stock/PurchaseBar';

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const lineTotal = (l) => round2((Number(l.quantity) || 0) * (Number(l.unitCost) || 0));

// Same search the page has always used (sales:search-products).
const searchItems = (query) => window.api.sales.searchProducts({ query });
const mapResult = (r) => ({
  key: r.variantId,
  title: r.productName,
  subtitle: [r.variantName !== 'Standard' ? r.variantName : null, r.sku || r.barcode].filter(Boolean).join(' · '),
  stock: `${formatCount(r.stockQty)} ${r.baseUnitName || ''}`,
});

// Admin-only, same rule as the rest of the Suppliers module. Writes the full
// purchases/purchase_items record; stock and the supplier's account follow.
export default function PurchaseEntry({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({ lines: {} });
  const [saveError, setSaveError] = useState('');
  const [completing, setCompleting] = useState(false);
  const [done, setDone] = useState(null);
  const [focusLineKey, setFocusLineKey] = useState(null);
  const savingRef = useRef(false);
  const pickerRef = useRef(null);

  const loadSuppliers = useCallback(async () => {
    setLoadingSuppliers(true);
    setLoadError(false);
    try {
      const rows = await window.api.suppliers.list();
      setSuppliers(rows.filter((r) => r.is_active));
    } catch {
      setLoadError(true);
    }
    setLoadingSuppliers(false);
  }, []);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Each pick adds its own line (picking the same item twice gives two lines).
  async function addVariant(variantId, searchRow) {
    let detail;
    try {
      detail = await window.api.sales.getVariantForCart({ variantId });
    } catch {
      detail = null;
    }
    if (!detail || !detail.defaultUnitId) {
      toast.error('This item has no selling unit configured.');
      return;
    }
    const unitId = detail.defaultUnitId;
    const unit = detail.units.find((u) => u.id === unitId);
    const key = `${detail.variant.id}-${Date.now()}`;

    setLines((prev) => [
      ...prev,
      {
        key,
        variantId: detail.variant.id,
        variantName: detail.variant.variantName,
        productName: detail.product.name,
        sku: searchRow?.sku || detail.variant.barcode || null,
        stockQty: detail.variant.stockQty,
        baseUnitName: detail.product.baseUnitName,
        units: detail.units,
        unitId,
        conversionFactor: unit.conversionFactor,
        quantity: 1,
        unitCost: unit.costPrice,
      },
    ]);
    setErrors((e) => ({ ...e, items: null }));
    setFocusLineKey(key);
  }

  const updateLineUnit = useCallback((key, newUnitId) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const unit = l.units.find((u) => u.id === newUnitId);
        return { ...l, unitId: newUnitId, conversionFactor: unit.conversionFactor, unitCost: unit.costPrice };
      })
    );
  }, []);

  const updateLineField = useCallback((key, field, value) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
    setErrors((e) => (e.lines[key] ? { ...e, lines: { ...e.lines, [key]: { ...e.lines[key], [field === 'unitCost' ? 'unitCost' : 'quantity']: null } } } : e));
  }, []);

  const removeLine = useCallback((key) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  function resetForm() {
    setSupplierId('');
    setReferenceNo('');
    setLines([]);
    setErrors({ lines: {} });
    setSaveError('');
    setFocusLineKey(null);
  }

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  // Same rules as always; returns the errors plus the id of the first problem.
  function validate() {
    const next = { lines: {} };
    let first = null;
    if (!supplierId) {
      next.supplier = 'Select a supplier.';
      first = 'purchase-supplier';
    }
    if (lines.length === 0) {
      next.items = 'Add at least one item.';
      first = first || 'purchase-item-search';
    }
    for (const l of lines) {
      const e = {};
      if (!Number(l.quantity) || Number(l.quantity) <= 0) e.quantity = `Enter a valid quantity for ${l.productName}.`;
      if (l.unitCost === '' || l.unitCost === null || l.unitCost === undefined || Number(l.unitCost) < 0 || Number.isNaN(Number(l.unitCost))) {
        e.unitCost = `Enter a valid buying price for ${l.productName}.`;
      }
      if (e.quantity || e.unitCost) {
        next.lines[l.key] = e;
        first = first || (e.quantity ? `pl-qty-${l.key}` : `pl-cost-${l.key}`);
      }
    }
    return { next, first };
  }

  async function handleComplete() {
    if (savingRef.current) return;
    setSaveError('');
    const { next, first } = validate();
    setErrors(next);
    if (first) {
      const el = document.getElementById(first);
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
      toast.error('Please check the highlighted fields');
      return;
    }

    const supplierName = suppliers.find((s) => String(s.id) === String(supplierId))?.name || 'this supplier';
    const total = round2(subtotal);
    savingRef.current = true;
    const ok = await confirm({
      title: 'Save this purchase?',
      message: `This adds stock for ${lines.length} items and adds ${formatCurrency(total)} to your account with ${supplierName}. Purchases can't be edited or deleted afterwards.`,
      confirmLabel: 'Save purchase',
      cancelLabel: 'Go back',
    });
    if (!ok) {
      savingRef.current = false;
      return;
    }

    setCompleting(true);
    let res;
    try {
      res = await window.api.purchases.create({
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
    } catch {
      res = { success: false };
    }
    setCompleting(false);
    savingRef.current = false;

    if (!res.success) {
      const msg = res.reason || 'Could not complete purchase.';
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    toast.success('Purchase saved');
    setDone({ supplierName, itemCount: lines.length, total, referenceNo: referenceNo.trim() });
    resetForm();
  }

  function startNew() {
    setDone(null);
    requestAnimationFrame(() => document.getElementById('purchase-supplier')?.focus());
  }

  if (user.role !== 'admin') {
    return (
      <Card>
        <EmptyState icon={Lock} title="Only the owner can record purchases" message="Ask the shop owner to sign in to add stock you bought." />
      </Card>
    );
  }

  const lineErrors = errors.lines || {};

  return (
    <div style={{ maxWidth: '960px', paddingBottom: theme.spacing.xxl }}>
      <StockIntro>Record stock you bought from a supplier. This adds to your stock and to what you owe them.</StockIntro>

      {done ? (
        <PurchaseDone {...done} onNew={startNew} onHistory={onNavigate ? () => onNavigate('/products/stock-movements') : null} />
      ) : loadError ? (
        <Card padding="0">
          <LoadError message="The supplier list couldn't be loaded." onRetry={loadSuppliers} />
        </Card>
      ) : loadingSuppliers ? (
        <Card>
          <Skeleton lines={3} />
        </Card>
      ) : (
        <>
          <PurchaseHeader
            suppliers={suppliers}
            supplierId={supplierId}
            onSupplierChange={(v) => {
              setSupplierId(v);
              setErrors((e) => ({ ...e, supplier: null }));
            }}
            referenceNo={referenceNo}
            onReferenceChange={setReferenceNo}
            error={errors.supplier}
            onSupplierChosen={() => pickerRef.current?.focus()}
          />
          <PurchaseLines
            lines={lines}
            lineTotal={lineTotal}
            errors={lineErrors}
            itemsError={errors.items}
            focusLineKey={focusLineKey}
            pickerRef={pickerRef}
            pickerProps={{ search: searchItems, mapResult, onPick: (r) => addVariant(r.variantId, r), debounceMs: 250 }}
            onUnit={updateLineUnit}
            onField={updateLineField}
            onRemove={removeLine}
          />
          {saveError && <Banner style={{ marginBottom: theme.spacing.md }}>{saveError}</Banner>}
          <PurchaseBar count={lines.length} total={round2(subtotal)} saving={completing} onSave={handleComplete} />
        </>
      )}
    </div>
  );
}
