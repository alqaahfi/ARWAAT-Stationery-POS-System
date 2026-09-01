import React, { useEffect, useState } from 'react';
import { 
  Barcode as BarcodeIcon, Tag, Truck, Building2, Package, Star, 
  Info, Layers, DollarSign, AlertCircle, Plus, Archive
} from 'lucide-react';
import { Card, PageHeader, Button, Label, TextInput, TextArea, Select, Checkbox, Banner, FieldError, HelperText } from '../../components/ui';
import theme from '../../config/theme';

const PRESET_UNITS = ['Piece', 'Dozen', 'Box', 'Pack', 'Ream', 'Set', 'Carton', 'Sheet', 'Roll', 'Pair'];

const emptyUnit = (isDefault) => ({ unitName: '', conversionFactor: 1, retailPrice: 0, wholesalePrice: 0, costPrice: 0, isDefaultSaleUnit: isDefault });
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
          }))
        );
        setLoading(false);
      });
    } else {
      // New product — prefill Min Stock Alert from App Preferences' default,
      // if one's been set. Never touches existing products (edit mode above
      // always uses the product's own saved value instead).
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
        <PageHeader title={isEdit ? 'Edit Product' : 'Add New Product'} />
        {error && (
          <div style={{ marginTop: theme.spacing.sm }}>
            <Banner tone="critical">{error}</Banner>
          </div>
        )}
      </div>

      {/* 3-Column Dashboard Layout - Fits screen, no page scrolling */}
      <div style={styles.dashboardGrid}>
        
        {/* Column 1: Details */}
        <div style={styles.column}>
          <div style={styles.columnHeader}>
            <Info size={18} color={theme.colors.primary} />
            <span>Product Details</span>
          </div>
          <div style={styles.columnContent}>
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

        {/* Column 2: Units & Pricing */}
        <div style={styles.column}>
          <div style={styles.columnHeader}>
            <DollarSign size={18} color={theme.colors.primary} />
            <span>Units & Pricing</span>
          </div>
          <div style={styles.columnContent}>
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

        {/* Column 3: Types / Variants */}
        <div style={styles.column}>
          <div style={styles.columnHeader}>
            <Layers size={18} color={theme.colors.primary} />
            <span>Types {hasTypes && <span style={styles.badge}>{types.length}</span>}</span>
          </div>
          <div style={styles.columnContent}>
            <TypesSection 
              types={types} 
              onAddType={addType} 
              onUpdateType={updateType} 
              onRemoveType={removeType} 
              onCheckBarcode={checkTypeBarcode} 
            />
          </div>
        </div>

      </div>

      <div style={styles.footer}>
        <Button variant="ghost" onClick={onCancel} style={{ minWidth: '120px', padding: '12px' }}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} style={{ minWidth: '160px', padding: '12px' }}>
          {saving ? 'Saving…' : 'Save Product'}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Field Helper ----------------

function FieldLabel({ icon: Icon, children, secondary }) {
  return (
    <div style={styles.fieldLabelWrap}>
      {Icon && <Icon size={14} style={{ color: theme.colors.textSecondary }} />}
      <Label style={{ margin: 0 }}>
        {children} {secondary && <span style={{ color: theme.colors.textSecondary, fontWeight: 'normal' }}>{secondary}</span>}
      </Label>
    </div>
  );
}

// ---------------- Column 1: Details Section ----------------

function DetailsSection(props) {
  const {
    hasTypes, topVariant, onTopBarcodeChange, onCheckTopBarcode, standardStartingStock, onStandardStartingStockChange,
    name, onNameChange, company, onCompanyChange, categories, categoryId, onCategoryChange,
    suppliers, supplierId, onSupplierChange, minStockAlert, onMinStockAlertChange,
    deadStockDays, onDeadStockDaysChange, isActive, onIsActiveChange, isAgencyItem, onIsAgencyItemChange,
    notes, onNotesChange,
  } = props;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      <div style={styles.sectionBlock}>
        <div style={styles.grid2Col}>
          <div>
            <FieldLabel>Product Name</FieldLabel>
            <TextInput value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus placeholder="Enter product name" />
          </div>
          <div>
            <FieldLabel icon={Building2} secondary="(optional)">Company / Brand</FieldLabel>
            <TextInput value={company} onChange={(e) => onCompanyChange(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
        </div>
        <div>
          <FieldLabel secondary="(optional)">Notes</FieldLabel>
          <TextArea value={notes} onChange={(e) => onNotesChange(e.target.value)} placeholder="Any specific details..." rows={2} />
        </div>
      </div>

      <div style={styles.sectionBlock}>
        <div style={styles.highlightSection}>
          <div style={styles.grid2Col}>
            <div>
              <FieldLabel icon={BarcodeIcon}>Barcode</FieldLabel>
              <TextInput
                value={topVariant.barcode}
                disabled={hasTypes}
                onChange={(e) => onTopBarcodeChange(e.target.value)}
                onBlur={onCheckTopBarcode}
                style={hasTypes ? { backgroundColor: 'rgba(0,0,0,0.03)', color: theme.colors.textSecondary } : undefined}
                placeholder="Scan or enter barcode"
              />
              <FieldError>{topVariant.barcodeError}</FieldError>
              <HelperText>
                {hasTypes ? 'Managed per Type.' : 'Leave blank if no barcode.'}
              </HelperText>
            </div>

            {!hasTypes && (
              <div>
                {topVariant.id ? (
                  <div style={styles.stockDisplayCard}>
                    <span style={styles.stockDisplayLabel}>Current Stock</span>
                    <span style={styles.stockDisplayValue}>{topVariant.stockQty}</span>
                    <HelperText>Edit via Adjustments.</HelperText>
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

        <div style={styles.grid2Col}>
          <div>
            <FieldLabel icon={Tag}>Category</FieldLabel>
            <Select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
              <option value="">Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel icon={Truck}>Supplier</FieldLabel>
            <Select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)}>
              <option value="">Select a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
        </div>

        <div style={styles.grid2Col}>
          <div>
            <FieldLabel icon={AlertCircle}>Min Stock Alert</FieldLabel>
            <TextInput type="number" value={minStockAlert} onChange={(e) => onMinStockAlertChange(e.target.value)} />
          </div>
          <div>
            <FieldLabel icon={AlertCircle} secondary="(optional)">Dead Stock Days</FieldLabel>
            <TextInput type="number" value={deadStockDays} onChange={(e) => onDeadStockDaysChange(e.target.value)} placeholder="Never" />
          </div>
        </div>
      </div>

      <div style={styles.settingsGrid}>
        <div style={styles.settingRow}>
          <Checkbox label="Active Status" checked={isActive} onChange={(e) => onIsActiveChange(e.target.checked)} />
          <HelperText>Turn off to hide from standard sales.</HelperText>
        </div>
        <div style={styles.settingRow}>
          <Checkbox label="Is Agency Item" checked={isAgencyItem} onChange={(e) => onIsAgencyItemChange(e.target.checked)} />
          <HelperText>Eligible for Percentage Pricing Rules.</HelperText>
        </div>
      </div>
    </div>
  );
}

// ---------------- Column 2: Units Section ----------------

function UnitsSection({ units, isPresetAdded, onTogglePreset, customUnitOpen, onOpenCustomUnit, customUnitName, onCustomUnitNameChange, onConfirmCustomUnit, onCancelCustomUnit, onUpdateUnit, onRemoveUnit, onSetDefaultUnit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      <div style={styles.chipRow}>
        {PRESET_UNITS.map((preset) => {
          const added = isPresetAdded(preset);
          return (
            <button key={preset} onClick={() => onTogglePreset(preset)} style={{ ...styles.chip, ...(added ? styles.chipAdded : {}) }}>
              {added ? '✓ ' : '+ '}{preset}
            </button>
          );
        })}
        <button onClick={onOpenCustomUnit} style={{...styles.chip, borderStyle: 'dashed'}}>
          <Plus size={14} style={{ marginRight: '4px' }} /> Custom
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
          <Package size={32} color={theme.colors.borderStrong} />
          <p>No selling units added.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {units.map((u, i) => (
          <div key={i} style={{ ...styles.unitCard, ...(u.isDefaultSaleUnit ? styles.unitCardActive : {}) }}>
            
            <div style={styles.unitCardHeader}>
              <div style={styles.unitCardTitleWrap}>
                <div style={styles.unitAvatar}>{u.unitName.charAt(0).toUpperCase() || 'U'}</div>
                <span style={styles.unitCardName}>{u.unitName || 'Unnamed unit'}</span>
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  title="Default sale unit"
                  onClick={() => onSetDefaultUnit(i)}
                  style={{ ...styles.iconBtn, ...(u.isDefaultSaleUnit ? styles.iconBtnActive : {}) }}
                >
                  <Star size={16} fill={u.isDefaultSaleUnit ? 'currentColor' : 'none'} />
                </button>
                <button title="Remove unit" style={styles.iconBtnDanger} onClick={() => onRemoveUnit(i)} disabled={units.length <= 1}>
                  ✕
                </button>
              </div>
            </div>

            <div style={styles.unitCardGrid}>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Conv. Factor</span>
                <input type="number" value={u.conversionFactor} onChange={(e) => onUpdateUnit(i, { conversionFactor: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Retail Price</span>
                <input type="number" value={u.retailPrice} onChange={(e) => onUpdateUnit(i, { retailPrice: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Wholesale</span>
                <input type="number" value={u.wholesalePrice} onChange={(e) => onUpdateUnit(i, { wholesalePrice: e.target.value })} style={styles.modernInput} />
              </div>
              <div style={styles.unitInputGroup}>
                <span style={styles.unitInputLabel}>Cost Price</span>
                <input type="number" value={u.costPrice} onChange={(e) => onUpdateUnit(i, { costPrice: e.target.value })} style={styles.modernInput} />
              </div>
            </div>
            
            {u.isDefaultSaleUnit && (
              <div style={styles.defaultBadge}>Primary Selling Unit</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Column 3: Types Section ----------------

function TypesSection({ types, onAddType, onUpdateType, onRemoveType, onCheckBarcode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {types.length === 0 ? (
        <div style={styles.emptyStateContainer}>
          <div style={styles.emptyStateIcon}><Layers size={32} /></div>
          <h3 style={styles.emptyStateTitle}>Add Variants?</h3>
          <p style={styles.emptyStateText}>
            You only need Types if this product comes in different colors, sizes, or flavors.
          </p>
          <Button onClick={onAddType} style={{ padding: '10px 24px' }}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Add First Type
          </Button>
        </div>
      ) : (
        <>
          <Banner tone="info">This product acts as a parent item. Each Type below is tracked and sold separately.</Banner>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {types.map((t, i) => (
              <div key={i} style={styles.typeCard}>
                <div style={styles.typeCardHeader}>
                  <div style={{ flex: 1 }}>
                    <span style={styles.typeCardLabel}>Type Name</span>
                    <input 
                      placeholder="e.g. Red, Large, 500ml" 
                      value={t.variantName} 
                      onChange={(e) => onUpdateType(i, { variantName: e.target.value })} 
                      style={styles.typeHeroInput}
                    />
                  </div>
                  <button title="Remove type" style={styles.iconBtnDanger} onClick={() => onRemoveType(i)}>
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
          
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
            <Button variant="secondary" onClick={onAddType} style={{ padding: '10px 24px', borderRadius: '24px' }}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Add Another Type
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------- Styles ----------------

const styles = {
  // App-level layout: Locked to screen height
  page: { 
    height: '100vh', 
    maxHeight: '100vh',
    display: 'flex', 
    flexDirection: 'column', 
    backgroundColor: '#f1f5f9', // subtle app background
    fontFamily: theme.font.family,
    overflow: 'hidden' // Critical for no-page-scroll requirement
  },
  topNav: {
    backgroundColor: '#ffffff',
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: `20px 32px 16px 32px`,
    flexShrink: 0,
    zIndex: 10
  },
  
  // 3-Column Dashboard Layout
  dashboardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    flex: 1,           // takes remaining height
    minHeight: 0,      // allows flex children to scroll instead of stretching parent
    padding: '24px 32px',
    overflow: 'hidden' // Grid container itself does not scroll
  },
  
  column: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
    overflow: 'hidden', // keeps header pinned, content scrolling
    minHeight: 0
  },
  columnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    backgroundColor: '#f8fafc',
    borderBottom: `1px solid ${theme.colors.border}`,
    fontWeight: 600,
    fontSize: '16px',
    color: theme.colors.textPrimary,
    flexShrink: 0 // Header never collapses
  },
  columnContent: {
    flex: 1,
    overflowY: 'auto', // ONLY the column content scrolls
    padding: '20px',
  },

  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: '20px 32px',
    backgroundColor: '#ffffff',
    borderTop: `1px solid ${theme.colors.border}`,
    boxShadow: '0 -4px 20px rgba(0,0,0,0.03)',
    flexShrink: 0,
    zIndex: 10
  },

  // Internal column structural elements
  sectionBlock: {
    paddingBottom: '20px',
    borderBottom: '1px dashed rgba(0,0,0,0.1)',
  },
  grid2Col: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '16px',
    marginBottom: '16px'
  },
  fieldLabelWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '8px'
  },
  highlightSection: {
    backgroundColor: 'rgba(0,0,0,0.02)',
    padding: '16px',
    borderRadius: '12px',
    marginBottom: '16px',
    border: '1px solid rgba(0,0,0,0.04)'
  },
  settingsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  settingRow: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '12px',
    backgroundColor: 'rgba(0,0,0,0.01)',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.03)'
  },
  badge: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '12px',
    marginLeft: '6px'
  },

  // Units styling
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '8px' },
  chip: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 14px',
    borderRadius: '24px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: '#ffffff',
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeSm,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s'
  },
  chipAdded: { 
    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
    borderColor: 'rgba(16, 185, 129, 0.3)', 
    color: '#059669' 
  },
  customUnitTray: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: '12px'
  },
  unitCard: {
    position: 'relative',
    backgroundColor: '#ffffff',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
    transition: 'border-color 0.2s',
  },
  unitCardActive: {
    borderColor: '#f59e0b',
    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)'
  },
  unitCardHeader: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: '16px'
  },
  unitCardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  unitAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    backgroundColor: 'rgba(0,0,0,0.04)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 600,
    color: theme.colors.textSecondary
  },
  unitCardName: { 
    fontWeight: 600, 
    fontSize: '15px',
    color: theme.colors.textPrimary 
  },
  unitCardGrid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 1fr', 
    gap: '12px' 
  },
  unitInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  unitInputLabel: {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  modernInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'rgba(0,0,0,0.01)',
    fontSize: '14px',
    fontFamily: theme.font.family,
    boxSizing: 'border-box',
    transition: 'border 0.2s',
  },
  defaultBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fef3c7',
    color: '#d97706',
    textAlign: 'center',
    fontSize: '10px',
    fontWeight: 600,
    padding: '4px',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    borderBottomLeftRadius: '11px',
    borderBottomRightRadius: '11px'
  },

  // Types Styling
  typeCard: {
    backgroundColor: '#ffffff',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  },
  typeCardHeader: {
    display: 'flex', 
    gap: '16px', 
    alignItems: 'center',
    paddingBottom: '16px',
    borderBottom: '1px dashed rgba(0,0,0,0.1)',
    marginBottom: '16px'
  },
  typeCardLabel: {
    display: 'block',
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontWeight: 600,
    textTransform: 'uppercase',
    marginBottom: '4px'
  },
  typeHeroInput: {
    width: '100%',
    border: 'none',
    borderBottom: '2px solid transparent',
    fontSize: '18px',
    fontWeight: 600,
    padding: '2px 0',
    color: theme.colors.textPrimary,
    backgroundColor: 'transparent',
    outline: 'none',
    boxShadow: 'none',
  },
  typeCardBody: {
    display: 'grid', 
    gridTemplateColumns: '1fr', // Stacked internally for column fit
    gap: '16px'
  },

  // Shared Utilities
  iconBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.colors.textSecondary,
    padding: '6px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s'
  },
  iconBtnActive: { color: '#f59e0b', backgroundColor: '#fef3c7' },
  iconBtnDanger: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.colors.textSecondary,
    padding: '6px',
    borderRadius: '8px',
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  stockDisplayCard: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid rgba(0,0,0,0.05)'
  },
  stockDisplayLabel: {
    fontSize: '11px',
    color: theme.colors.textSecondary,
    fontWeight: 600,
    textTransform: 'uppercase'
  },
  stockDisplayValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: theme.colors.textPrimary,
    lineHeight: '1.2'
  },
  emptyStateContainer: {
    textAlign: 'center',
    padding: '32px 16px',
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px dashed rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  emptyStateIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textSecondary,
    marginBottom: '12px'
  },
  emptyStateTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 8px 0'
  },
  emptyStateText: {
    color: theme.colors.textSecondary,
    marginBottom: '20px',
    fontSize: '13px',
    lineHeight: '1.4'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '24px',
    color: theme.colors.textSecondary,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: '12px',
    textAlign: 'center',
    fontSize: '13px'
  },
  loadingWrapper: { 
    height: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: theme.colors.textSecondary,
    fontSize: '16px'
  }
};