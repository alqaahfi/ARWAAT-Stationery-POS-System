import React, { useEffect, useRef, useState } from 'react';
import { PackageX } from 'lucide-react';
import { Button, Card, EmptyState, Skeleton, useConfirm, useToast } from '../../components/ui';
import theme from '../../config/theme';
import { DetailsSection, KindAndNameSection, SimpleStockSection, StockAlertsSection } from './form/BasicsSection';
import { PackSizesSection } from './form/PackSizesSection';
import { SpecialPricesSection } from './form/SpecialPricesSection';
import { TypesSection } from './form/TypesSection';
import { MoreOptionsSection } from './form/MoreOptionsSection';
import { StickyActions } from './form/StickyActions';

const emptyUnit = (isDefault) => ({
  unitName: '', conversionFactor: 1, retailPrice: 0, wholesalePrice: 0, costPrice: 0, isDefaultSaleUnit: isDefault,
  netRateC1: '', netRateC2: '', netRateC3: '', netRateC4: '', netRateC5: '',
  pricingMethod: 'simple', tradePrice: '', purchaseDiscount: '', extraDiscount: '',
  saleDiscountC1: '', saleDiscountC2: '', saleDiscountC3: '', saleDiscountC4: '', saleDiscountC5: '',
});

const blank = (v) => v === '' || v === null || v === undefined;
const round2 = (n) => String(Math.round(n * 100) / 100);

// Trade Price method: derives the standard price fields the price engine and POS read.
// cost = trade - purchase % - extra amount; retail = wholesale = trade; C1..C5 = trade - sale %.
// A blank sale discount leaves that Price Level without an override.
function withTradePrices(u) {
  if (u.pricingMethod !== 'trade') return u;
  const trade = Number(u.tradePrice) || 0;
  const off = (pct) => round2(Math.max(0, trade - (trade * (Number(pct) || 0)) / 100));
  const next = {
    ...u,
    costPrice: round2(Math.max(0, trade - (trade * (Number(u.purchaseDiscount) || 0)) / 100 - (Number(u.extraDiscount) || 0))),
    retailPrice: round2(trade),
    wholesalePrice: round2(trade),
  };
  for (let i = 1; i <= 5; i++) next[`netRateC${i}`] = blank(u[`saleDiscountC${i}`]) ? '' : off(u[`saleDiscountC${i}`]);
  return next;
}
const emptyType = () => ({ variantName: '', barcode: '', barcodeError: '', startingStock: 0 });

const BARCODE_TAKEN = 'This barcode is already used by another item.';
const BARCODE_TWICE = 'This barcode is used twice in this product.';

export default function ProductForm({ productId, onDone, onCancel }) {
  const isEdit = !!productId;
  const toast = useToast();
  const confirm = useConfirm();
  const formRef = useRef(null);
  const savingRef = useRef(false);

  const [loading, setLoading] = useState(isEdit);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [sku, setSku] = useState('');
  const [skuError, setSkuError] = useState('');
  const [skuChecking, setSkuChecking] = useState(false);
  const [company, setCompany] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [baseUnitName, setBaseUnitName] = useState('Piece');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const [minStockAlert, setMinStockAlert] = useState(0);
  const [deadStockDays, setDeadStockDays] = useState('');

  const [topVariant, setTopVariant] = useState({ id: null, barcode: '', barcodeError: '', stockQty: 0 });
  const [standardStartingStock, setStandardStartingStock] = useState(0);

  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([{ ...emptyUnit(true), unitName: 'Piece' }]);
  const [unitsError, setUnitsError] = useState('');
  const [customUnitOpen, setCustomUnitOpen] = useState(false);
  const [customUnitName, setCustomUnitName] = useState('');

  // Simple Product or Product with Types — the first thing the form asks.
  const [kind, setKind] = useState('simple');
  const hasTypes = kind === 'types';

  useEffect(() => {
    window.api.categories.list().then(setCategories);
    window.api.suppliers.list().then((rows) => setSuppliers(rows.filter((r) => r.is_active)));

    if (productId) {
      window.api.products
        .getById({ id: productId })
        .then((p) => {
          if (!p) {
            setLoadFailed(true);
            setLoading(false);
            return;
          }
          setName(p.name);
          setSku(p.sku || '');
          setCompany(p.company_name || '');
          setCategoryId(p.category_id || '');
          setSupplierId(p.supplier_id || '');
          setBaseUnitName(p.base_unit_name);
          setIsActive(!!p.is_active);
          setNotes(p.notes || '');
          setMinStockAlert(p.min_stock_alert);
          setDeadStockDays(p.dead_stock_days ?? '');

          const isImplicitStandard = p.variants.length === 1 && p.variants[0].variant_name === 'Standard';
          if (isImplicitStandard) {
            const v = p.variants[0];
            setTopVariant({ id: v.id, barcode: v.barcode || '', barcodeError: '', stockQty: v.stock_qty });
            setTypes([]);
            setKind('simple');
          } else {
            setKind('types');
            setTopVariant({ id: null, barcode: '', barcodeError: '', stockQty: 0 });
            setTypes(
              p.variants.map((v) => ({
                id: v.id,
                variantName: v.variant_name,
                barcode: v.barcode || '',
                barcodeError: '',
                stockQty: v.stock_qty,
                startingStock: 0,
              }))
            );
          }

          setUnits(
            p.units.map((u) => ({
              id: u.id,
              unitName: u.unit_name,
              conversionFactor: u.conversion_factor,
              retailPrice: u.retail_price,
              wholesalePrice: u.wholesale_price,
              costPrice: u.cost_price,
              isDefaultSaleUnit: !!u.is_default_sale_unit,
              netRateC1: u.net_rate_c1 ?? '',
              netRateC2: u.net_rate_c2 ?? '',
              netRateC3: u.net_rate_c3 ?? '',
              netRateC4: u.net_rate_c4 ?? '',
              netRateC5: u.net_rate_c5 ?? '',
              pricingMethod: u.pricing_method === 'trade' ? 'trade' : 'simple',
              tradePrice: u.trade_price ?? '',
              purchaseDiscount: u.purchase_discount ?? '',
              extraDiscount: u.extra_discount ?? '',
              saleDiscountC1: u.sale_discount_c1 ?? '',
              saleDiscountC2: u.sale_discount_c2 ?? '',
              saleDiscountC3: u.sale_discount_c3 ?? '',
              saleDiscountC4: u.sale_discount_c4 ?? '',
              saleDiscountC5: u.sale_discount_c5 ?? '',
            }))
          );
          setLoading(false);
        })
        .catch(() => {
          setLoadFailed(true);
          setLoading(false);
        });
    } else {
      window.api.settings.getAll().then((s) => {
        if (s.default_low_stock_alert !== undefined && s.default_low_stock_alert !== '') {
          setMinStockAlert(Number(s.default_low_stock_alert) || 0);
        }
      });
    }
  }, [productId]);

  // ---------- uniqueness checks (each returns its error, '' when fine) ----------

  async function checkSku() {
    const code = sku.trim();
    if (!code) {
      setSkuError('');
      return '';
    }
    setSkuChecking(true);
    const res = await window.api.products.checkSkuUnique({ sku: code, excludeId: productId || undefined });
    const err = res.available ? '' : 'This item code is already used.';
    setSkuChecking(false);
    setSkuError(err);
    return err;
  }

  async function checkTopBarcode() {
    const code = topVariant.barcode.trim();
    if (!code) {
      setTopVariant((tv) => ({ ...tv, barcodeError: '' }));
      return '';
    }
    setTopVariant((tv) => ({ ...tv, checking: true }));
    const res = await window.api.products.checkBarcodeUnique({ barcode: code, excludeVariantId: topVariant.id });
    const err = res.available ? '' : BARCODE_TAKEN;
    setTopVariant((tv) => ({ ...tv, checking: false, barcodeError: err }));
    return err;
  }

  async function checkTypeBarcode(index) {
    const row = types[index];
    if (!row.barcode || !row.barcode.trim()) {
      updateType(index, { barcodeError: '' });
      return '';
    }
    updateType(index, { checking: true });
    const res = await window.api.products.checkBarcodeUnique({ barcode: row.barcode.trim(), excludeVariantId: row.id });
    const err = res.available ? '' : BARCODE_TAKEN;
    updateType(index, { checking: false, barcodeError: err });
    return err;
  }

  // ---------- Types ----------

  // Switching the toggle moves the barcode / starting stock between the single
  // item fields and the first Type, so nothing typed is lost.
  function changeKind(next) {
    if (next === kind) return;
    if (next === 'types') {
      setKind('types');
      if (types.length === 0) {
        setTypes([
          {
            id: topVariant.id || undefined,
            variantName: topVariant.id ? 'Standard' : '',
            barcode: topVariant.barcode,
            barcodeError: '',
            stockQty: topVariant.stockQty,
            startingStock: Number(standardStartingStock) || 0,
          },
        ]);
        setTopVariant({ id: null, barcode: '', barcodeError: '', stockQty: 0 });
      }
      return;
    }
    if (types.some((t) => t.id)) {
      toast.info('Types that are already saved cannot be turned back into a simple product.');
      return;
    }
    const first = types[0];
    setTopVariant({ id: null, barcode: first?.barcode || '', barcodeError: '', stockQty: 0 });
    setStandardStartingStock(Number(first?.startingStock) || 0);
    setTypes([]);
    setKind('simple');
  }

  function addType() {
    setTypes((prev) => [...prev, emptyType()]);
  }

  function updateType(index, patch) {
    setTypes((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function removeType(index) {
    const removed = types[index];
    if (removed.id) {
      const ok = await confirm({
        title: 'Remove this Type?',
        message: 'Its sales and stock history are kept.',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (!ok) return;
    }
    if (types.length <= 1) {
      toast.info('A product with Types needs at least one Type.');
      return;
    }
    setTypes(types.filter((_, i) => i !== index));
  }

  // ---------- Pack sizes ----------

  function isPresetAdded(preset) {
    return units.some((u) => u.unitName.trim().toLowerCase() === preset.toLowerCase());
  }

  function togglePresetUnit(preset) {
    const existingIndex = units.findIndex((u) => u.unitName.trim().toLowerCase() === preset.toLowerCase());
    if (existingIndex >= 0) removeUnit(existingIndex);
    else addUnitNamed(preset);
  }

  function addUnitNamed(unitName) {
    setUnits((prev) => [...prev, { ...emptyUnit(prev.length === 0), unitName }]);
    setUnitsError('');
  }

  function updateUnit(index, patch) {
    setUnits((prev) => prev.map((row, i) => (i === index ? withTradePrices({ ...row, ...patch }) : row)));
  }

  async function removeUnit(index) {
    if (units.length <= 1) {
      toast.info('Keep at least one pack size.');
      return;
    }
    if (units[index].id) {
      const ok = await confirm({
        title: 'Remove this pack size?',
        message: 'Past sales keep their history.',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (!ok) return;
    }
    setUnits((prev) => {
      if (prev.length <= 1) return prev;
      const removingDefault = prev[index].isDefaultSaleUnit;
      let next = prev.filter((_, i) => i !== index);
      if (removingDefault && next.length > 0 && !next.some((u) => u.isDefaultSaleUnit)) {
        next = next.map((u, i) => (i === 0 ? { ...u, isDefaultSaleUnit: true } : u));
      }
      return next;
    });
  }

  function setDefaultUnit(index) {
    setUnits((prev) => prev.map((row, i) => ({ ...row, isDefaultSaleUnit: i === index })));
  }

  function confirmCustomUnit() {
    const trimmed = customUnitName.trim();
    if (!trimmed) return;
    addUnitNamed(trimmed);
    setCustomUnitName('');
    setCustomUnitOpen(false);
  }

  // ---------- Save ----------

  // Waits for the error state to render (and a collapsed section to open)
  // before looking for the first highlighted field.
  function focusFirstInvalid() {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const root = formRef.current;
        if (!root) return;
        const el = root.querySelector('[aria-invalid="true"]') || root.querySelector('[data-section-error]');
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus?.({ preventScroll: true });
      })
    );
  }

  async function handleSave() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setShowErrors(true);

    try {
      const nameErr = name.trim() ? '' : 'Enter a name for this product.';
      setNameError(nameErr);
      const unitsErr =
        units.length === 0 ? 'Add at least one pack size.' : units.some((u) => !u.unitName.trim()) ? 'Give every pack size a name.' : '';
      setUnitsError(unitsErr);
      const typesErr = !hasTypes ? '' : types.length === 0 ? 'Add at least one Type.' : types.some((t) => !t.variantName.trim()) ? 'Give every Type a name.' : '';

      const [skuErr, topErr, typeErrs] = await Promise.all([
        checkSku(),
        hasTypes ? Promise.resolve('') : checkTopBarcode(),
        Promise.all(types.map((_, i) => checkTypeBarcode(i))),
      ]);

      // The same barcode typed on two Types of this product.
      const seen = new Map();
      const finalTypeErrs = types.map((t, i) => {
        const code = t.barcode.trim();
        if (typeErrs[i] || !code) return typeErrs[i];
        if (seen.has(code)) return BARCODE_TWICE;
        seen.set(code, i);
        return '';
      });
      if (finalTypeErrs.some((e, i) => e !== typeErrs[i])) {
        setTypes((prev) => prev.map((t, i) => ({ ...t, barcodeError: finalTypeErrs[i] ?? t.barcodeError })));
      }

      if (nameErr || unitsErr || typesErr || skuErr || topErr || finalTypeErrs.some(Boolean)) {
        toast.error(typesErr || 'Please check the highlighted fields');
        focusFirstInvalid();
        return;
      }

      const payload = {
        name: name.trim(),
        sku: sku.trim() || null,
        companyName: company.trim() || null,
        categoryId: categoryId ? Number(categoryId) : null,
        supplierId: supplierId ? Number(supplierId) : null,
        baseUnitName,
        isActive,
        notes: notes.trim() || null,
        minStockAlert: Number(minStockAlert) || 0,
        deadStockDays: deadStockDays === '' ? null : Number(deadStockDays),
        variants: (hasTypes ? types : []).map((t) => ({
          id: t.id,
          variantName: t.variantName.trim() || 'Standard',
          barcode: t.barcode.trim() || null,
          startingStock: Number(t.startingStock) || 0,
        })),
        units: units.map((u) => ({
          id: u.id,
          unitName: u.unitName.trim(),
          conversionFactor: Number(u.conversionFactor) || 1,
          retailPrice: Number(u.retailPrice) || 0,
          wholesalePrice: Number(u.wholesalePrice) || 0,
          costPrice: Number(u.costPrice) || 0,
          isDefaultSaleUnit: u.isDefaultSaleUnit,
          netRateC1: u.netRateC1 === '' ? null : Number(u.netRateC1),
          netRateC2: u.netRateC2 === '' ? null : Number(u.netRateC2),
          netRateC3: u.netRateC3 === '' ? null : Number(u.netRateC3),
          netRateC4: u.netRateC4 === '' ? null : Number(u.netRateC4),
          netRateC5: u.netRateC5 === '' ? null : Number(u.netRateC5),
          pricingMethod: u.pricingMethod,
          tradePrice: blank(u.tradePrice) ? null : Number(u.tradePrice),
          purchaseDiscount: blank(u.purchaseDiscount) ? null : Number(u.purchaseDiscount),
          extraDiscount: blank(u.extraDiscount) ? null : Number(u.extraDiscount),
          saleDiscountC1: blank(u.saleDiscountC1) ? null : Number(u.saleDiscountC1),
          saleDiscountC2: blank(u.saleDiscountC2) ? null : Number(u.saleDiscountC2),
          saleDiscountC3: blank(u.saleDiscountC3) ? null : Number(u.saleDiscountC3),
          saleDiscountC4: blank(u.saleDiscountC4) ? null : Number(u.saleDiscountC4),
          saleDiscountC5: blank(u.saleDiscountC5) ? null : Number(u.saleDiscountC5),
        })),
        standardStartingStock: hasTypes ? 0 : Number(standardStartingStock) || 0,
        standardBarcode: hasTypes ? null : topVariant.barcode.trim() || null,
        standardVariantId: hasTypes ? null : topVariant.id || null,
      };

      const res = isEdit ? await window.api.products.update({ id: productId, ...payload }) : await window.api.products.create(payload);
      if (!res.success) {
        toast.error(res.reason || 'Could not save the product.');
        return;
      }
      toast.success('Product saved');
      onDone();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={styles.column}>
        {[4, 2, 5].map((lines, i) => (
          <Card key={i}>
            <Skeleton width="30%" height="18px" style={{ marginBottom: theme.spacing.md }} />
            <Skeleton lines={lines} />
          </Card>
        ))}
      </div>
    );
  }

  if (loadFailed) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={PackageX}
          color="red"
          title="We couldn't open this product"
          message="It may have been removed on another computer."
          action={<Button onClick={onCancel}>Back to products</Button>}
        />
      </Card>
    );
  }

  return (
    <div ref={formRef} data-product-form="" style={styles.page}>
      <div style={styles.column}>
        <KindAndNameSection
          kind={kind}
          onKindChange={changeKind}
          isEdit={isEdit}
          name={name}
          onNameChange={(v) => {
            setName(v);
            if (v.trim()) setNameError('');
          }}
          nameError={nameError}
        />

        {hasTypes ? (
          <TypesSection
            types={types}
            baseUnitName={baseUnitName}
            showErrors={showErrors}
            onAddType={addType}
            onUpdateType={(index, patch) => updateType(index, 'barcode' in patch ? { ...patch, barcodeError: '' } : patch)}
            onRemoveType={removeType}
            onCheckBarcode={checkTypeBarcode}
          />
        ) : (
          <SimpleStockSection
            topVariant={topVariant}
            onTopBarcodeChange={(v) => setTopVariant((tv) => ({ ...tv, barcode: v, barcodeError: '' }))}
            onCheckTopBarcode={checkTopBarcode}
            standardStartingStock={standardStartingStock}
            onStandardStartingStockChange={setStandardStartingStock}
            baseUnitName={baseUnitName}
          />
        )}

        <DetailsSection
          company={company}
          onCompanyChange={setCompany}
          categories={categories}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          suppliers={suppliers}
          supplierId={supplierId}
          onSupplierChange={setSupplierId}
          sku={sku}
          onSkuChange={(v) => {
            setSku(v);
            setSkuError('');
          }}
          onCheckSku={checkSku}
          skuChecking={skuChecking}
          skuError={skuError}
        />

        <StockAlertsSection
          minStockAlert={minStockAlert}
          onMinStockAlertChange={setMinStockAlert}
          deadStockDays={deadStockDays}
          onDeadStockDaysChange={setDeadStockDays}
          baseUnitName={baseUnitName}
        />

        <PackSizesSection
          units={units}
          baseUnitName={baseUnitName}
          error={unitsError}
          showErrors={showErrors}
          isPresetAdded={isPresetAdded}
          onTogglePreset={togglePresetUnit}
          customUnitOpen={customUnitOpen}
          onOpenCustomUnit={() => setCustomUnitOpen(true)}
          customUnitName={customUnitName}
          onCustomUnitNameChange={setCustomUnitName}
          onConfirmCustomUnit={confirmCustomUnit}
          onCancelCustomUnit={() => {
            setCustomUnitOpen(false);
            setCustomUnitName('');
          }}
          onUpdateUnit={updateUnit}
          onRemoveUnit={removeUnit}
          onSetDefaultUnit={setDefaultUnit}
        />

        <SpecialPricesSection units={units} onUpdateUnit={updateUnit} />

        <MoreOptionsSection
          isEdit={isEdit}
          notes={notes}
          onNotesChange={setNotes}
          isActive={isActive}
          onIsActiveChange={setIsActive}
        />
      </div>

      <StickyActions onCancel={onCancel} onSave={handleSave} saving={saving} />
    </div>
  );
}

const styles = {
  page: { minHeight: '100%', display: 'flex', flexDirection: 'column' },
  column: {
    width: '100%',
    maxWidth: '860px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxl,
  },
};
