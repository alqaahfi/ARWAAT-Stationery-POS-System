import React, { useEffect, useState } from 'react';
import { 
  Barcode as BarcodeIcon, Tag, Truck, Building2, Package, Star, 
  Info, Layers, DollarSign, AlertCircle, Plus, Archive
} from 'lucide-react';
import { Card, PageHeader, Button, Label, TextInput, TextArea, Select, Checkbox, Banner, FieldError, HelperText } from '../../components/ui';
import theme from '../../config/theme';

const PRESET_UNITS = ['Piece', 'Dozen', 'Box', 'Pack', 'Ream', 'Set', 'Carton', 'Sheet', 'Roll', 'Pair'];

const TIER_KEYS = ['netRateC1', 'netRateC2', 'netRateC3', 'netRateC4', 'netRateC5'];

const emptyUnit = (isDefault) => ({
  unitName: '', conversionFactor: 1, retailPrice: 0, wholesalePrice: 0, costPrice: 0, isDefaultSaleUnit: isDefault,
  netRateC1: '', netRateC2: '', netRateC3: '', netRateC4: '', netRateC5: '',
});
const emptyType = () => ({ variantName: '', barcode: '', barcodeError: '', startingStock: 0 });

export default function ProductForm({ productId, onDone, onCancel }) {
  const isEdit = !!productId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [baseUnitName, setBaseUnitName] = useState('Piece'); 
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [isAgencyItem, setIsAgencyItem] = useState(false);

  const [minStockAlert, setMinStockAlert] = useState(0);
  const [deadStockDays, setDeadStockDays] = useState('');

  const [topVariant, setTopVariant] = useState({ id: null, barcode: '', barcodeError: '', stockQty: 0 });
  const [standardStartingStock, setStandardStartingStock] = useState(0);

  const [types, setTypes] = useState([]);
  const [units, setUnits] = useState([emptyUnit(true)]);
  const [customUnitOpen, setCustomUnitOpen] = useState(false);
  const [customUnitName, setCustomUnitName] = useState('');

  const hasTypes = types.length > 0;

  useEffect(() => {
    window.api.categories.list().then(setCategories);
    window.api.suppliers.list().then((rows) => setSuppliers(rows.filter((r) => r.is_active)));

    if (productId) {
      window.api.products.getById({ id: productId }).then((p) => {
        if (!p) {
          setError('Product not found.');
          setLoading(false);
          return;
        }
        setName(p.name);
        setCompany(p.company_name || '');
        setCategoryId(p.category_id || '');
        setSupplierId(p.supplier_id || '');
        setBaseUnitName(p.base_unit_name);
        setIsActive(!!p.is_active);
        setNotes(p.notes || '');
        setMinStockAlert(p.min_stock_alert);
        setDeadStockDays(p.dead_stock_days ?? '');
        setIsAgencyItem(!!p.is_agency_item);

        const isImplicitStandard = p.variants.length === 1 && p.variants[0].variant_name === 'Standard';
        if (isImplicitStandard) {
          const v = p.variants[0];
          setTopVariant({ id: v.id, barcode: v.barcode || '', barcodeError: '', stockQty: v.stock_qty });
          setTypes([]);
        } else {
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
          }))
        );
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

  async function checkTopBarcode() {
    if (!topVariant.barcode.trim()) {
      setTopVariant((tv) => ({ ...tv, barcodeError: '' }));
      return;
    }
    const res = await window.api.products.checkBarcodeUnique({ barcode: topVariant.barcode.trim(), excludeVariantId: topVariant.id });
    setTopVariant((tv) => ({ ...tv, barcodeError: res.available ? '' : 'Already used by another item.' }));
  }

  function addType() {
    if (types.length === 0 && (topVariant.id || topVariant.barcode)) {
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
    } else {
      setTypes((prev) => [...prev, emptyType()]);
    }
  }

  function updateType(index, patch) {
    setTypes((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeType(index) {
    const removed = types[index];
    const next = types.filter((_, i) => i !== index);
    setTypes(next);
    if (next.length === 0) {
      setTopVariant({ id: removed.id || null, barcode: removed.barcode || '', barcodeError: '', stockQty: removed.id ? removed.stockQty : 0 });
      setStandardStartingStock(removed.id ? 0 : Number(removed.startingStock) || 0);
    }
  }

  async function checkTypeBarcode(index) {
    const row = types[index];
    if (!row.barcode || !row.barcode.trim()) {
      updateType(index, { barcodeError: '' });
      return;
    }
    const res = await window.api.products.checkBarcodeUnique({ barcode: row.barcode.trim(), excludeVariantId: row.id });
    updateType(index, { barcodeError: res.available ? '' : 'Already used by another Type.' });
  }

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
  }

  function updateUnit(index, patch) {
    setUnits((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeUnit(index) {
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

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (units.length === 0 || units.some((u) => !u.unitName.trim())) {
      setError('At least one selling unit (with a name) is required.');
      return;
    }
    if (topVariant.barcodeError || types.some((t) => t.barcodeError)) {
      setError('Fix barcode errors before saving.');
      return;
    }

    const payload = {
      name: name.trim(),
      companyName: company.trim() || null,
      categoryId: categoryId ? Number(categoryId) : null,
      supplierId: supplierId ? Number(supplierId) : null,
      baseUnitName,
      isActive,
      notes: notes.trim() || null,
      minStockAlert: Number(minStockAlert) || 0,
      deadStockDays: deadStockDays === '' ? null : Number(deadStockDays),
      isAgencyItem,
      variants: types.map((t) => ({
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
      })),
      standardStartingStock: hasTypes ? 0 : Number(standardStartingStock) || 0,
      standardBarcode: hasTypes ? null : topVariant.barcode.trim() || null,
      standardVariantId: hasTypes ? null : topVariant.id || null,
    };

    setSaving(true);
    const res = isEdit ? await window.api.products.update({ id: productId, ...payload }) : await window.api.products.create(payload);
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save product.');
      return;
    }
    onDone();
  }

  if (loading) return <div style={styles.loadingWrapper}>Loading product data…</div>;

  return (
    <div style={styles.page}>
      
      <div style={styles.topNav}>
        <div style={styles.headerContainer}>
          <PageHeader title={isEdit ? 'Edit Product' : 'Add New Product'} />
          <p style={styles.subtext}>Enter the details below to configure your product, inventory, and pricing.</p>
        </div>
      </div>

      <div style={styles.mainContainer}>
        {error && (
          <div style={{ marginBottom: '24px' }}>
            <Banner tone="critical">{error}</Banner>
          </div>
        )}

        {/* Section 1: Details */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Info size={20} color={theme.colors.primary} />
            <h2 style={styles.cardTitle}>Product Details</h2>
          </div>
          <div style={styles.cardBody}>
            <DetailsSection
              hasTypes={hasTypes}
              topVariant={topVariant}
              onTopBarcodeChange={(v) => setTopVariant((tv) => ({ ...tv, barcode: v }))}
              onCheckTopBarcode={checkTopBarcode}
              standardStartingStock={standardStartingStock}
              onStandardStartingStockChange={setStandardStartingStock}
              name={name}
              onNameChange={setName}
              company={company}
              onCompanyChange={setCompany}
              categories={categories}
              categoryId={categoryId}
              onCategoryChange={setCategoryId}
              suppliers={suppliers}
              supplierId={supplierId}
              onSupplierChange={setSupplierId}
              minStockAlert={minStockAlert}
              onMinStockAlertChange={setMinStockAlert}
              deadStockDays={deadStockDays}
              onDeadStockDaysChange={setDeadStockDays}
              isActive={isActive}
              onIsActiveChange={setIsActive}
              isAgencyItem={isAgencyItem}
              onIsAgencyItemChange={setIsAgencyItem}
              notes={notes}
              onNotesChange={setNotes}
            />
          </div>
        </div>

        {/* Section 2: Units & Pricing */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <DollarSign size={20} color={theme.colors.primary} />
            <h2 style={styles.cardTitle}>Units & Pricing</h2>
          </div>
          <div style={styles.cardBody}>
            <UnitsSection
              units={units}
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
          </div>
        </div>

        {/* Section 3: Types / Variants */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <Layers size={20} color={theme.colors.primary} />
            <h2 style={styles.cardTitle}>Product Variants</h2>
            {hasTypes && <span style={styles.badge}>{types.length} Types</span>}
          </div>
          <div style={styles.cardBody}>
            <TypesSection 
              types={types} 
              onAddType={addType} 
              onUpdateType={updateType} 
              onRemoveType={removeType} 
              onCheckBarcode={checkTypeBarcode} 
            />
          </div>
        </div>
        
        {/* Spacer to push content above sticky footer */}
        <div style={{ height: '40px' }}></div>
      </div>

      <div style={styles.stickyFooter}>
        <div style={styles.footerContainer}>
          <Button variant="ghost" onClick={onCancel} style={styles.btnCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} style={styles.btnSave}>
            {saving ? 'Saving…' : 'Save Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Field Helper ----------------

function FieldLabel({ icon: Icon, children, secondary }) {
  return (
    <div style={styles.fieldLabelWrap}>
      {Icon && <Icon size={14} style={{ color: theme.colors.textSecondary }} />}
      <Label style={{ margin: 0, fontWeight: 500, color: '#374151' }}>
        {children} {secondary && <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>{secondary}</span>}
      </Label>
    </div>
  );
}

// ---------------- Section 1: Details Section ----------------

function DetailsSection(props) {
  const {
    hasTypes, topVariant, onTopBarcodeChange, onCheckTopBarcode, standardStartingStock, onStandardStartingStockChange,
    name, onNameChange, company, onCompanyChange, categories, categoryId, onCategoryChange,
    suppliers, supplierId, onSupplierChange, minStockAlert, onMinStockAlertChange,
    deadStockDays, onDeadStockDaysChange, isActive, onIsActiveChange, isAgencyItem, onIsAgencyItemChange,
    notes, onNotesChange,
  } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <div style={styles.grid2Col}>
        <div style={{ gridColumn: 'span 2' }}>
          <FieldLabel>Product Name</FieldLabel>
          <TextInput value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus placeholder="e.g. Premium Cotton T-Shirt" />
        </div>
        <div>
          <FieldLabel icon={Building2} secondary="(optional)">Brand / Company</FieldLabel>
          <TextInput value={company} onChange={(e) => onCompanyChange(e.target.value)} placeholder="e.g. Acme Corp" />
        </div>
        <div>
          <FieldLabel icon={Tag}>Category</FieldLabel>
          <Select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div style={styles.highlightSection}>
        <div style={styles.grid2Col}>
          <div>
            <FieldLabel icon={BarcodeIcon}>Standard Barcode</FieldLabel>
            <TextInput
              value={topVariant.barcode}
              disabled={hasTypes}
              onChange={(e) => onTopBarcodeChange(e.target.value)}
              onBlur={onCheckTopBarcode}
              style={hasTypes ? { backgroundColor: '#f3f4f6', color: '#9ca3af' } : undefined}
              placeholder="Scan or enter barcode"
            />
            <FieldError>{topVariant.barcodeError}</FieldError>
            <HelperText>
              {hasTypes ? 'Barcode managed individually below.' : 'Leave blank if not applicable.'}
            </HelperText>
          </div>

          {!hasTypes && (
            <div>
              {topVariant.id ? (
                <div style={styles.stockDisplayCard}>
                  <span style={styles.stockDisplayLabel}>Current Stock</span>
                  <span style={styles.stockDisplayValue}>{topVariant.stockQty}</span>
                </div>
              ) : (
                <div>
                  <FieldLabel>Starting Stock</FieldLabel>
                  <TextInput type="number" value={standardStartingStock} onChange={(e) => onStandardStartingStockChange(e.target.value)} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles.grid3Col}>
        <div>
          <FieldLabel icon={Truck}>Supplier</FieldLabel>
          <Select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)}>
            <option value="">Select a supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel icon={AlertCircle}>Min Stock Alert</FieldLabel>
          <TextInput type="number" value={minStockAlert} onChange={(e) => onMinStockAlertChange(e.target.value)} />
        </div>
        <div>
          <FieldLabel icon={AlertCircle} secondary="(optional)">Dead Stock Days</FieldLabel>
          <TextInput type="number" value={deadStockDays} onChange={(e) => onDeadStockDaysChange(e.target.value)} placeholder="Never" />
        </div>
      </div>

      <div style={styles.grid2Col}>
        <div style={{ gridColumn: 'span 2' }}>
          <FieldLabel secondary="(optional)">Internal Notes</FieldLabel>
          <TextArea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Add any specific details here..." rows={3} />
        </div>
      </div>

      <div style={styles.settingsGrid}>
        <div style={styles.settingRow}>
          <Checkbox label="Active Status (Available for sale)" checked={isActive} onChange={(e) => onIsActiveChange(e.target.checked)} />
        </div>
        <div style={styles.settingRow}>
          <Checkbox label="Is Agency Item (Eligible for special percentage rules)" checked={isAgencyItem} onChange={(e) => onIsAgencyItemChange(e.target.checked)} />
        </div>
      </div>
    </div>
  );
}

// ---------------- Section 2: Units Section ----------------

function UnitsSection({ units, isPresetAdded, onTogglePreset, customUnitOpen, onOpenCustomUnit, customUnitName, onCustomUnitNameChange, onConfirmCustomUnit, onCancelCustomUnit, onUpdateUnit, onRemoveUnit, onSetDefaultUnit }) {
  const [expandedTiers, setExpandedTiers] = useState({});
  const toggleTiers = (i) => setExpandedTiers((prev) => ({ ...prev, [i]: !prev[i] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={styles.chipRow}>
        <span style={styles.chipLabel}>Quick Add:</span>
        {PRESET_UNITS.map((preset) => {
          const added = isPresetAdded(preset);
          return (
            <button key={preset} onClick={() => onTogglePreset(preset)} style={{ ...styles.chip, ...(added ? styles.chipAdded : {}) }}>
              {added ? '✓ ' : '+ '}{preset}
            </button>
          );
        })}
        <button onClick={onOpenCustomUnit} style={{...styles.chip, borderStyle: 'dashed'}}>
          <Plus size={14} style={{ marginRight: '4px' }} /> Custom Unit
        </button>
      </div>

      {customUnitOpen && (
        <div style={styles.customUnitTray}>
          <TextInput
            autoFocus
            placeholder="Enter custom unit name..."
            value={customUnitName}
            onChange={(e) => onCustomUnitNameChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onConfirmCustomUnit()}
            style={{ flex: 1 }}
          />
          <Button onClick={onConfirmCustomUnit}>Add</Button>
          <Button variant="ghost" onClick={onCancelCustomUnit}>Cancel</Button>
        </div>
      )}

      {units.length === 0 && (
        <div style={styles.emptyState}>
          <Package size={32} color="#9ca3af" />
          <p>No selling units added. Click a preset above to begin.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {units.map((u, i) => (
          <div key={i} style={{ ...styles.unitCard, ...(u.isDefaultSaleUnit ? styles.unitCardActive : {}) }}>
            
            <div style={styles.unitCardHeader}>
              <div style={styles.unitCardTitleWrap}>
                <div style={{...styles.unitAvatar, backgroundColor: u.isDefaultSaleUnit ? '#eff6ff' : '#f3f4f6', color: u.isDefaultSaleUnit ? '#2563eb' : '#6b7280'}}>
                  {u.unitName.charAt(0).toUpperCase() || 'U'}
                </div>
                <span style={styles.unitCardName}>{u.unitName || 'Unnamed unit'}</span>
                {u.isDefaultSaleUnit && <span style={styles.defaultBadge}>Primary</span>}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  title="Set as Default Sale Unit"
                  onClick={() => onSetDefaultUnit(i)}
                  style={{ ...styles.iconBtn, ...(u.isDefaultSaleUnit ? styles.iconBtnActive : {}) }}
                >
                  <Star size={18} fill={u.isDefaultSaleUnit ? 'currentColor' : 'none'} />
                </button>
                <button title="Remove Unit" style={styles.iconBtnDanger} onClick={() => onRemoveUnit(i)} disabled={units.length <= 1}>
                  ✕
                </button>
              </div>
            </div>

            <div style={styles.unitCardGrid}>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Conversion Factor</span>
                <input type="number" value={u.conversionFactor} onChange={(e) => onUpdateUnit(i, { conversionFactor: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Cost Price ($)</span>
                <input type="number" value={u.costPrice} onChange={(e) => onUpdateUnit(i, { costPrice: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Wholesale Price ($)</span>
                <input type="number" value={u.wholesalePrice} onChange={(e) => onUpdateUnit(i, { wholesalePrice: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Retail Price ($)</span>
                <input type="number" value={u.retailPrice} onChange={(e) => onUpdateUnit(i, { retailPrice: e.target.value })} style={styles.modernInput} />
              </div>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f3f4f6' }}>
              <button type="button" onClick={() => toggleTiers(i)} style={styles.tierToggle}>
                {expandedTiers[i] ? 'Hide Advanced Tiers' : 'Set Advanced Tier Pricing (C1–C5)'}
                {TIER_KEYS.some((k) => u[k] !== '' && u[k] !== null && u[k] !== undefined) && !expandedTiers[i] && (
                  <span style={styles.tierToggleBadge}>Configured</span>
                )}
              </button>
              
              {expandedTiers[i] && (
                <div style={styles.tierGrid}>
                  {TIER_KEYS.map((key, tierIndex) => (
                    <div key={key} style={styles.unitInputGroup}>
                      <span style={styles.unitInputLabel}>C{tierIndex + 1} Rate</span>
                      <input
                        type="number"
                        placeholder="Default"
                        value={u[key]}
                        onChange={(e) => onUpdateUnit(i, { [key]: e.target.value })}
                        style={styles.modernInput}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Section 3: Types Section ----------------

function TypesSection({ types, onAddType, onUpdateType, onRemoveType, onCheckBarcode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {types.length === 0 ? (
        <div style={styles.emptyStateContainer}>
          <div style={styles.emptyStateIcon}><Layers size={28} /></div>
          <h3 style={styles.emptyStateTitle}>Does this product have variants?</h3>
          <p style={styles.emptyStateText}>
            Add Types if this product comes in different colors, sizes, flavors, or capacities.
          </p>
          <Button onClick={onAddType} style={{ padding: '10px 24px' }}>
            <Plus size={18} style={{ marginRight: '6px' }} /> Add Variants
          </Button>
        </div>
      ) : (
        <>
          <Banner tone="info">This product acts as a parent. Each Type below has its own stock and barcode.</Banner>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {types.map((t, i) => (
              <div key={i} style={styles.typeCard}>
                <div style={styles.typeCardHeader}>
                  <div style={{ flex: 1 }}>
                    <span style={styles.typeCardLabel}>Variant Name</span>
                    <input 
                      placeholder="e.g. Red, Large, 500ml" 
                      value={t.variantName} 
                      onChange={(e) => onUpdateType(i, { variantName: e.target.value })} 
                      style={styles.typeHeroInput}
                    />
                  </div>
                  <button title="Remove variant" style={styles.iconBtnDanger} onClick={() => onRemoveType(i)}>
                    ✕
                  </button>
                </div>

                <div style={styles.typeCardBody}>
                  <div>
                    <FieldLabel icon={BarcodeIcon} secondary="(opt)">Barcode</FieldLabel>
                    <TextInput value={t.barcode} onChange={(e) => onUpdateType(i, { barcode: e.target.value })} onBlur={() => onCheckBarcode(i)} placeholder="Scan barcode" />
                    <FieldError>{t.barcodeError}</FieldError>
                  </div>
                  <div>
                    {t.id ? (
                      <div style={styles.stockDisplayCard}>
                         <span style={styles.stockDisplayLabel}>Current Stock</span>
                         <span style={styles.stockDisplayValue}>{t.stockQty}</span>
                      </div>
                    ) : (
                      <div>
                        <FieldLabel>Starting Stock</FieldLabel>
                        <TextInput type="number" value={t.startingStock} onChange={(e) => onUpdateType(i, { startingStock: e.target.value })} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '8px' }}>
            <Button variant="secondary" onClick={onAddType} style={{ padding: '10px 24px' }}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Add Another Variant
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Styles (Complete Overhaul) ----------------

const styles = {
  // App-level layout: Standard scrolling page
  page: { 
    minHeight: '100vh',
    backgroundColor: '#f9fafb', // Modern, clean gray background
    fontFamily: theme.font.family,
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  topNav: {
    backgroundColor: '#ffffff',
    borderBottom: `1px solid #e5e7eb`,
    padding: `24px 32px`,
  },
  headerContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
  },
  subtext: {
    color: '#6b7280',
    marginTop: '8px',
    fontSize: '14px',
  },
  
  // Main centralized container
  mainContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    width: '100%',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px', // Comfortable spacing between sections
  },
  
  // Card Component Styling
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: `1px solid #e5e7eb`,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 24px',
    backgroundColor: '#ffffff',
    borderBottom: `1px solid #f3f4f6`,
  },
  cardTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
  },
  cardBody: {
    padding: '24px',
  },

  // Sticky Action Footer
  stickyFooter: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTop: `1px solid #e5e7eb`,
    padding: '16px 32px',
    boxShadow: '0 -4px 12px rgba(0,0,0,0.05)',
    zIndex: 50,
  },
  footerContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '16px',
  },
  btnCancel: { minWidth: '120px', padding: '12px 24px', fontSize: '15px' },
  btnSave: { minWidth: '160px', padding: '12px 24px', fontSize: '15px', fontWeight: 600 },

  // Grid Layouts inside Cards
  grid2Col: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
  },
  grid3Col: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '24px',
  },
  
  fieldLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  highlightSection: {
    backgroundColor: '#f8fafc',
    padding: '20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
  },
  settingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '16px',
    marginTop: '8px'
  },
  settingRow: {
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #f3f4f6'
  },
  badge: {
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: '13px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '16px',
    marginLeft: 'auto',
  },

  // Units styling
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' },
  chipLabel: { fontSize: '14px', color: '#6b7280', fontWeight: 500, marginRight: '8px' },
  chip: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    borderRadius: '24px',
    border: `1px solid #d1d5db`,
    backgroundColor: '#ffffff',
    color: '#4b5563',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  chipAdded: { 
    backgroundColor: '#ecfdf5', 
    borderColor: '#34d399', 
    color: '#059669' 
  },
  customUnitTray: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb'
  },
  
  unitCard: {
    position: 'relative',
    backgroundColor: '#ffffff',
    border: `1px solid #e5e7eb`,
    borderRadius: '12px',
    padding: '24px',
    transition: 'all 0.2s ease',
  },
  unitCardActive: {
    borderColor: '#3b82f6',
    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)',
  },
  unitCardHeader: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: '24px'
  },
  unitCardTitleWrap: { display: 'flex', alignItems: 'center', gap: '16px' },
  unitAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    fontSize: '16px'
  },
  unitCardName: { fontWeight: 600, fontSize: '18px', color: '#111827' },
  unitCardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '20px'
  },
  
  tierToggle: {
    color: '#3b82f6',
    background: 'none',
    border: 'none',
    fontWeight: 500,
    fontSize: '14px',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  tierToggleBadge: {
    backgroundColor: '#ecfdf5',
    color: '#059669',
    fontSize: '12px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '12px',
  },
  tierGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '16px',
    marginTop: '20px',
  },
  
  unitInputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  unitInputLabel: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  modernInput: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: `1px solid #d1d5db`,
    backgroundColor: '#ffffff',
    fontSize: '15px',
    fontFamily: theme.font.family,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  defaultBadge: {
    backgroundColor: '#dbeafe',
    color: '#1d4ed8',
    fontSize: '12px',
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: '16px',
  },

  // Types Styling
  typeCard: {
    backgroundColor: '#f8fafc',
    border: `1px solid #e2e8f0`,
    borderRadius: '12px',
    padding: '20px',
  },
  typeCardHeader: {
    display: 'flex', 
    gap: '16px', 
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px solid #e2e8f0',
    marginBottom: '20px'
  },
  typeCardLabel: {
    display: 'block',
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: '6px'
  },
  typeHeroInput: {
    width: '100%',
    border: 'none',
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    backgroundColor: 'transparent',
    outline: 'none',
  },
  typeCardBody: {
    display: 'grid', 
    gridTemplateColumns: '1fr',
    gap: '20px'
  },

  // Shared Utilities
  iconBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    transition: 'all 0.2s ease'
  },
  iconBtnActive: { color: '#f59e0b', backgroundColor: '#fef3c7' },
  iconBtnDanger: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#ef4444',
    padding: '8px',
    borderRadius: '8px',
    display: 'flex',
    transition: 'background-color 0.2s ease',
  },
  
  stockDisplayCard: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  stockDisplayLabel: { fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' },
  stockDisplayValue: { fontSize: '24px', fontWeight: 700, color: '#0f172a', marginTop: '4px' },
  
  emptyStateContainer: {
    textAlign: 'center',
    padding: '48px 24px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '2px dashed #cbd5e1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '28px',
    backgroundColor: '#e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#64748b',
    marginBottom: '16px'
  },
  emptyStateTitle: { fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: '#1e293b' },
  emptyStateText: { color: '#64748b', marginBottom: '24px', fontSize: '15px' },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '32px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px dashed #d1d5db',
  },
  loadingWrapper: { 
    height: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: '#6b7280',
    fontSize: '18px'
  }
};