import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Field, Select, TextInput } from '../../../components/ui';
import { formatCount } from '../../../utils/format';
import { CheckedInput, NumInput, SectionCard, grid } from './fields';

const c = theme.colors;

// Section 1 — always open. Barcode + starting stock live here only while the
// product is a single item (zero Types).
export function BasicsSection({
  hasTypes,
  isEdit,
  topVariant,
  onTopBarcodeChange,
  onCheckTopBarcode,
  standardStartingStock,
  onStandardStartingStockChange,
  baseUnitName,
  name,
  onNameChange,
  nameError,
  company,
  onCompanyChange,
  categories,
  categoryId,
  onCategoryChange,
  suppliers,
  supplierId,
  onSupplierChange,
  sku,
  onSkuChange,
  onCheckSku,
  skuChecking,
  skuError,
  onFixStock,
}) {
  return (
    <SectionCard title="Basics">
      {!hasTypes && (
        <Field label="Barcode" hint={topVariant.barcodeError ? undefined : 'Optional. Scan it or type it in.'} error={topVariant.barcodeError}>
          <CheckedInput
            scanner
            value={topVariant.barcode}
            onChange={(e) => onTopBarcodeChange(e.target.value)}
            onBlur={onCheckTopBarcode}
            checking={topVariant.checking}
            placeholder="Scan or type the barcode"
            aria-invalid={!!topVariant.barcodeError}
          />
        </Field>
      )}

      <Field label="Name" required error={nameError}>
        <TextInput value={name} onChange={(e) => onNameChange(e.target.value)} autoFocus={!isEdit} placeholder="e.g. Blue Gel Pen" />
      </Field>

      <div style={grid(220)}>
        <Field label="Brand">
          <TextInput value={company} onChange={(e) => onCompanyChange(e.target.value)} placeholder="e.g. Dollar, Piano" />
        </Field>
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.parent_name ? `${cat.parent_name} › ${cat.name}` : cat.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Supplier">
          <Select value={supplierId} onChange={(e) => onSupplierChange(e.target.value)}>
            <option value="">No supplier</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={glossary.itemCode} hint={skuError ? undefined : 'Optional. Your own short code for this item.'} error={skuError}>
          <CheckedInput
            scanner
            value={sku}
            onChange={(e) => onSkuChange(e.target.value)}
            onBlur={onCheckSku}
            checking={skuChecking}
            placeholder="e.g. GP-BLU"
            aria-invalid={!!skuError}
          />
        </Field>
      </div>

      {!hasTypes &&
        (topVariant.id ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, ...theme.type.body }}>
            <span style={{ color: c.labelSecondary }}>In stock:</span>
            <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold }}>
              {formatCount(topVariant.stockQty)} {baseUnitName}
            </span>
            {onFixStock && (
              <Button variant="plain" size="sm" onClick={onFixStock}>
                {glossary.fixStockCount}
              </Button>
            )}
          </div>
        ) : (
          <Field label={glossary.startingStock} hint="You can change stock later with Fix Stock Count." style={{ maxWidth: '240px', marginBottom: 0 }}>
            <NumInput allowDecimal={false} value={standardStartingStock} onChange={onStandardStartingStockChange} />
          </Field>
        ))}
    </SectionCard>
  );
}

// Section 2 — always open, two fields side by side.
export function StockAlertsSection({ minStockAlert, onMinStockAlertChange, deadStockDays, onDeadStockDaysChange, baseUnitName }) {
  return (
    <SectionCard title="Stock alerts">
      <div style={grid(240)}>
        <Field label={glossary.warnBelow} hint={`In ${baseUnitName}. You'll see this item under Running Low.`} style={{ marginBottom: 0 }}>
          <NumInput allowDecimal={false} value={minStockAlert} onChange={onMinStockAlertChange} />
        </Field>
        <Field label={glossary.notSellingDays} hint="Leave empty to never flag it under Not Selling." style={{ marginBottom: 0 }}>
          <NumInput allowDecimal={false} value={deadStockDays} onChange={onDeadStockDaysChange} placeholder="Never" />
        </Field>
      </div>
    </SectionCard>
  );
}
