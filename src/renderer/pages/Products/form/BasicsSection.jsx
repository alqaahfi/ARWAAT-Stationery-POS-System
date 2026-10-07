import React from 'react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Field, FieldError, HelperText, Label, SegmentedControl, Select, TextInput } from '../../../components/ui';
import { formatCount } from '../../../utils/format';
import { CheckedInput, NumInput, SectionCard, grid } from './fields';

const c = theme.colors;

// Step 1 — what kind of product is this, and what is it called? The choice
// decides which of the sections below appear.
export function KindAndNameSection({
  kind, onKindChange, isEdit, name, onNameChange, nameError,
  searchAlias, onSearchAliasChange, onAutoUrdu, autoUrduBusy,
}) {
  return (
    <SectionCard title="What are you adding?">
      <SegmentedControl
        label="Kind of product"
        fullWidth
        value={kind}
        onChange={onKindChange}
        options={[
          { value: 'simple', label: 'Simple Product' },
          { value: 'types', label: 'Product with Types' },
        ]}
      />
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, margin: `${theme.spacing.sm} 0 ${theme.spacing.md}` }}>
        {kind === 'simple'
          ? 'One item with a single barcode and stock count.'
          : 'One name with several colours or sizes. Each Type has its own barcode and stock.'}
      </div>
      <div style={{ marginBottom: theme.spacing.md }}>
        <Label htmlFor="product-name" style={{ marginTop: 0 }}>
          Name<span style={{ color: c.redText }}> *</span>
        </Label>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'stretch' }}>
          <TextInput
            id="product-name"
            dir="auto"
            aria-invalid={!!nameError}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus={!isEdit}
            placeholder="e.g. Blue Gel Pen"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button variant="tinted" size="md" loading={autoUrduBusy} disabled={!name.trim()} onClick={onAutoUrdu} style={{ flexShrink: 0 }}>
            Auto Urdu Name
          </Button>
        </div>
        {nameError ? (
          <FieldError>{nameError}</FieldError>
        ) : (
          <HelperText>Shown on screen and on receipts. Type in English, then tap Auto Urdu Name.</HelperText>
        )}
      </div>
      <Field label="Search spelling (English)" hint="Cashiers can find this item by typing this. Not printed anywhere." style={{ marginBottom: 0 }}>
        <TextInput
          value={searchAlias}
          onChange={(e) => onSearchAliasChange(e.target.value)}
          placeholder="e.g. Blue Gel Pen"
          style={{ background: c.fill }}
        />
      </Field>
    </SectionCard>
  );
}

// Simple products only — the one barcode and the starting stock.
export function SimpleStockSection({ topVariant, onTopBarcodeChange, onCheckTopBarcode, standardStartingStock, onStandardStartingStockChange, baseUnitName }) {
  return (
    <SectionCard title="Barcode and stock">
      <div style={grid(240)}>
        <Field label="Barcode" hint={topVariant.barcodeError ? undefined : 'Optional. Scan it or type it in.'} error={topVariant.barcodeError} style={{ marginBottom: 0 }}>
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
        {topVariant.id ? (
          <Field label="In stock" hint="Change stock from the Stock page." style={{ marginBottom: 0 }}>
            <div style={{ ...theme.type.body, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, minHeight: theme.control.input, display: 'flex', alignItems: 'center' }}>
              {formatCount(topVariant.stockQty)} {baseUnitName}
            </div>
          </Field>
        ) : (
          <Field label={glossary.startingStock} hint="How many you have right now." style={{ marginBottom: 0 }}>
            <NumInput allowDecimal={false} value={standardStartingStock} onChange={onStandardStartingStockChange} />
          </Field>
        )}
      </div>
    </SectionCard>
  );
}

// Brand, category, supplier and item code.
export function DetailsSection({
  company, onCompanyChange, categories, categoryId, onCategoryChange, suppliers, supplierId, onSupplierChange,
  sku, onSkuChange, onCheckSku, skuChecking, skuError,
}) {
  return (
    <SectionCard title="Details">
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
