import React, { useEffect, useState } from 'react';
import { Card, PageHeader, Button, Label, TextInput, TextArea, Select, Checkbox, Banner, FieldError, HelperText } from '../../components/ui';
import theme from '../../config/theme';

export default function ProductForm({ productId, onDone, onCancel }) {
  const isEdit = !!productId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [skuError, setSkuError] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [baseUnitName, setBaseUnitName] = useState('Piece');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const [minStockAlert, setMinStockAlert] = useState(0);
  const [deadStockDays, setDeadStockDays] = useState('');

  const [pricingType, setPricingType] = useState('fixed');
  const [defaultPercentage, setDefaultPercentage] = useState('');
  const [isAgencyItem, setIsAgencyItem] = useState(false);

  const [variants, setVariants] = useState([]);
  const [standardStartingStock, setStandardStartingStock] = useState(0);
  const [units, setUnits] = useState([
    { unitName: '', conversionFactor: 1, retailPrice: 0, wholesalePrice: 0, costPrice: 0, isDefaultSaleUnit: true },
  ]);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
    // suppliers:list now returns both active and inactive suppliers (like
    // customers:list) — this dropdown only ever offered active ones.
    window.api.suppliers.list().then((rows) => setSuppliers(rows.filter((r) => r.is_active)));

    if (productId) {
      window.api.products.getById({ id: productId }).then((p) => {
        if (!p) {
          setError('Product not found.');
          setLoading(false);
          return;
        }
        setName(p.name);
        setSku(p.sku || '');
        setCategoryId(p.category_id || '');
        setSupplierId(p.supplier_id || '');
        setBaseUnitName(p.base_unit_name);
        setIsActive(!!p.is_active);
        setNotes(p.notes || '');
        setMinStockAlert(p.min_stock_alert);
        setDeadStockDays(p.dead_stock_days ?? '');
        setPricingType(p.pricing_type);
        setDefaultPercentage(p.default_percentage ?? '');
        setIsAgencyItem(!!p.is_agency_item);
        setVariants(
          p.variants.map((v) => ({
            id: v.id,
            variantName: v.variant_name,
            barcode: v.barcode || '',
            stockQty: v.stock_qty,
            startingStock: 0,
          }))
        );
        setUnits(
          p.units.map((u) => ({
            id: u.id,
            unitName: u.unit_name,
            conversionFactor: u.conversion_factor,
            retailPrice: u.retail_price,
            wholesalePrice: u.wholesale_price,
            costPrice: u.cost_price,
            isDefaultSaleUnit: !!u.is_default_sale_unit,
          }))
        );
        setLoading(false);
      });
    }
  }, [productId]);

  async function checkSku() {
    if (!sku.trim()) {
      setSkuError('');
      return;
    }
    const res = await window.api.products.checkSkuUnique({ sku: sku.trim(), excludeId: productId });
    setSkuError(res.available ? '' : 'Already used by another product.');
  }

  function addVariantRow() {
    setVariants((v) => [...v, { variantName: '', barcode: '', startingStock: 0 }]);
  }
  function updateVariant(index, patch) {
    setVariants((v) => v.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeVariant(index) {
    setVariants((v) => v.filter((_, i) => i !== index));
  }
  async function checkBarcode(index) {
    const row = variants[index];
    if (!row.barcode || !row.barcode.trim()) {
      updateVariant(index, { barcodeError: '' });
      return;
    }
    const res = await window.api.products.checkBarcodeUnique({ barcode: row.barcode.trim(), excludeVariantId: row.id });
    updateVariant(index, { barcodeError: res.available ? '' : 'Already used by another variant.' });
  }

  function addUnitRow() {
    setUnits((u) => [
      ...u,
      { unitName: '', conversionFactor: 1, retailPrice: 0, wholesalePrice: 0, costPrice: 0, isDefaultSaleUnit: false },
    ]);
  }
  function updateUnit(index, patch) {
    setUnits((u) => u.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeUnit(index) {
    if (units.length <= 1) return;
    setUnits((u) => u.filter((_, i) => i !== index));
  }
  function setDefaultUnit(index) {
    setUnits((u) => u.map((row, i) => ({ ...row, isDefaultSaleUnit: i === index })));
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (skuError) {
      setError('Fix the SKU error before saving.');
      return;
    }
    if (units.length === 0) {
      setError('At least one selling unit is required.');
      return;
    }
    if (units.some((u) => !u.unitName.trim())) {
      setError('Every unit row needs a name.');
      return;
    }
    if (variants.some((v) => v.barcodeError)) {
      setError('Fix barcode errors before saving.');
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim() || null,
      categoryId: categoryId ? Number(categoryId) : null,
      supplierId: supplierId ? Number(supplierId) : null,
      baseUnitName: baseUnitName.trim() || 'Piece',
      isActive,
      notes: notes.trim() || null,
      minStockAlert: Number(minStockAlert) || 0,
      deadStockDays: deadStockDays === '' ? null : Number(deadStockDays),
      pricingType,
      defaultPercentage: pricingType === 'percentage' ? Number(defaultPercentage) || 0 : null,
      isAgencyItem,
      variants: variants.map((v) => ({
        id: v.id,
        variantName: v.variantName.trim() || 'Standard',
        barcode: v.barcode.trim() || null,
        startingStock: Number(v.startingStock) || 0,
      })),
      units: units.map((u) => ({
        id: u.id,
        unitName: u.unitName.trim(),
        conversionFactor: Number(u.conversionFactor) || 1,
        retailPrice: Number(u.retailPrice) || 0,
        wholesalePrice: Number(u.wholesalePrice) || 0,
        costPrice: Number(u.costPrice) || 0,
        isDefaultSaleUnit: u.isDefaultSaleUnit,
      })),
      standardStartingStock: variants.length === 0 ? Number(standardStartingStock) || 0 : 0,
    };

    setSaving(true);
    const res = isEdit
      ? await window.api.products.update({ id: productId, ...payload })
      : await window.api.products.create(payload);
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save product.');
      return;
    }
    onDone();
  }

  if (loading) return <div style={{ color: theme.colors.textSecondary }}>Loading…</div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Product' : 'Add New Product'}
        actions={
          <>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Product'}
            </Button>
          </>
        }
      />

      <Banner>{error}</Banner>

      {/* Section A — Basic Info */}
      <Card style={{ marginTop: '16px' }}>
        <SectionTitle>Basic Info</SectionTitle>

        <Label>Name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />

        <Label>SKU (optional)</Label>
        <TextInput value={sku} onChange={(e) => setSku(e.target.value)} onBlur={checkSku} />
        <FieldError>{skuError}</FieldError>

        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <Label>Category</Label>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div style={{ flex: 1 }}>
            <Label>Supplier</Label>
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Label>Base Unit Name</Label>
        <TextInput value={baseUnitName} onChange={(e) => setBaseUnitName(e.target.value)} />

        <Checkbox label="Active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />

        <Label>Notes (optional)</Label>
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Card>

      {/* Section B — Stock & Alerts */}
      <Card style={{ marginTop: '16px' }}>
        <SectionTitle>Stock & Alerts</SectionTitle>

        <Label>Minimum Stock Alert</Label>
        <TextInput type="number" value={minStockAlert} onChange={(e) => setMinStockAlert(e.target.value)} />
        <HelperText>Get a low-stock warning when total stock falls below this number, in base units.</HelperText>

        <Label>Dead Stock Days (optional)</Label>
        <TextInput type="number" value={deadStockDays} onChange={(e) => setDeadStockDays(e.target.value)} />
        <HelperText>Flag this item as dead stock if it hasn't sold in this many days. Leave blank to never flag it.</HelperText>
      </Card>

      {/* Section C — Pricing Type */}
      <Card style={{ marginTop: '16px' }}>
        <SectionTitle>Pricing Type</SectionTitle>

        <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
          <label style={styles.radioLabel}>
            <input type="radio" checked={pricingType === 'fixed'} onChange={() => setPricingType('fixed')} />
            Fixed Pricing
          </label>
          <label style={styles.radioLabel}>
            <input type="radio" checked={pricingType === 'percentage'} onChange={() => setPricingType('percentage')} />
            Percentage-Based Pricing
          </label>
        </div>

        {pricingType === 'percentage' && (
          <>
            <Label>Default Percentage (%)</Label>
            <TextInput type="number" value={defaultPercentage} onChange={(e) => setDefaultPercentage(e.target.value)} />
            <HelperText>Default margin applied over cost price. Can be overridden per customer or customer category later.</HelperText>
          </>
        )}

        <Checkbox label="Is Agency Item" checked={isAgencyItem} onChange={(e) => setIsAgencyItem(e.target.checked)} />
      </Card>

      {/* Section D — Variants */}
      <Card style={{ marginTop: '16px' }}>
        <SectionTitle>Variants</SectionTitle>

        {variants.map((v, i) => (
          <div key={i} style={styles.row}>
            <div style={{ flex: 2 }}>
              <TextInput
                placeholder="Variant name (e.g. Blue)"
                value={v.variantName}
                onChange={(e) => updateVariant(i, { variantName: e.target.value })}
              />
            </div>
            <div style={{ flex: 2 }}>
              <TextInput
                placeholder="Barcode (optional)"
                value={v.barcode}
                onChange={(e) => updateVariant(i, { barcode: e.target.value })}
                onBlur={() => checkBarcode(i)}
              />
              <FieldError>{v.barcodeError}</FieldError>
            </div>
            <div style={{ flex: 1.5, fontSize: '13px' }}>
              {v.id ? (
                <div style={{ color: theme.colors.textSecondary }}>
                  Stock: {v.stockQty}
                  <div style={{ fontSize: '11px' }}>(edit via Stock Adjustments)</div>
                </div>
              ) : (
                <TextInput
                  type="number"
                  placeholder="Starting stock"
                  value={v.startingStock}
                  onChange={(e) => updateVariant(i, { startingStock: e.target.value })}
                />
              )}
            </div>
            <Button variant="ghost" style={styles.removeBtn} onClick={() => removeVariant(i)}>
              ✕
            </Button>
          </div>
        ))}

        {variants.length === 0 && (
          <>
            <Label>Starting Stock (Standard variant)</Label>
            <TextInput type="number" value={standardStartingStock} onChange={(e) => setStandardStartingStock(e.target.value)} />
          </>
        )}

        <Button variant="secondary" style={{ marginTop: '14px' }} onClick={addVariantRow}>
          + Add Variant
        </Button>
      </Card>

      {/* Section E — Units & Pricing */}
      <Card style={{ marginTop: '16px' }}>
        <SectionTitle>Units & Pricing</SectionTitle>

        {units.map((u, i) => (
          <div key={i} style={styles.row}>
            <div style={{ flex: 1.5 }}>
              <TextInput placeholder="Unit name" value={u.unitName} onChange={(e) => updateUnit(i, { unitName: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <TextInput
                type="number"
                placeholder="Conversion"
                value={u.conversionFactor}
                onChange={(e) => updateUnit(i, { conversionFactor: e.target.value })}
              />
            </div>
            {pricingType === 'fixed' && (
              <>
                <div style={{ flex: 1 }}>
                  <TextInput
                    type="number"
                    placeholder="Retail price"
                    value={u.retailPrice}
                    onChange={(e) => updateUnit(i, { retailPrice: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextInput
                    type="number"
                    placeholder="Wholesale price"
                    value={u.wholesalePrice}
                    onChange={(e) => updateUnit(i, { wholesalePrice: e.target.value })}
                  />
                </div>
              </>
            )}
            <div style={{ flex: 1 }}>
              <TextInput
                type="number"
                placeholder="Cost price"
                value={u.costPrice}
                onChange={(e) => updateUnit(i, { costPrice: e.target.value })}
              />
            </div>
            <label style={styles.radioLabel}>
              <input type="radio" name="defaultUnit" checked={u.isDefaultSaleUnit} onChange={() => setDefaultUnit(i)} />
              Default
            </label>
            <Button variant="ghost" style={styles.removeBtn} onClick={() => removeUnit(i)} disabled={units.length <= 1}>
              ✕
            </Button>
          </div>
        ))}

        <Button variant="secondary" style={{ marginTop: '14px' }} onClick={addUnitRow}>
          + Add Unit
        </Button>
      </Card>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h4 style={{ color: theme.colors.textPrimary, fontSize: '15px', margin: '0 0 6px' }}>{children}</h4>;
}

const styles = {
  row: { display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '12px' },
  radioLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: theme.colors.textSecondary, fontSize: '13px', whiteSpace: 'nowrap' },
  removeBtn: { padding: '10px 12px', flexShrink: 0 },
};
