import React, { useEffect, useRef, useState } from 'react';
import { Stepper } from '../../components/ui';
import theme from '../../config/theme';
import { CheckStep, ImportStep, UploadStep } from './import/ImportSteps';
import { parseCsv, toCsv, downloadCsv } from '../../utils/csv';

const TEMPLATE_HEADERS = [
  'name', 'sku', 'category', 'base_unit_name', 'min_stock_alert', 'dead_stock_days',
  'pricing_type', 'default_percentage', 'variant_name', 'barcode', 'starting_stock',
  'unit_name', 'conversion_factor', 'retail_price', 'wholesale_price', 'cost_price',
  'is_default_sale_unit',
];

const TEMPLATE_ROWS = [
  { name: 'Gel Pen', sku: 'GP-BLU', category: 'Pens', base_unit_name: 'Piece', min_stock_alert: 20, dead_stock_days: '', pricing_type: 'fixed', default_percentage: '', variant_name: 'Blue', barcode: '', starting_stock: 50, unit_name: 'Piece', conversion_factor: 1, retail_price: 20, wholesale_price: 15, cost_price: 10, is_default_sale_unit: 1 },
  { name: 'Gel Pen', sku: 'GP-BLU', category: 'Pens', base_unit_name: 'Piece', min_stock_alert: 20, dead_stock_days: '', pricing_type: 'fixed', default_percentage: '', variant_name: 'Blue', barcode: '', starting_stock: 50, unit_name: 'Box', conversion_factor: 10, retail_price: 190, wholesale_price: 145, cost_price: 95, is_default_sale_unit: 0 },
  { name: 'Physics Book Class 9', sku: 'PB9', category: 'Books', base_unit_name: 'Piece', min_stock_alert: 5, dead_stock_days: 90, pricing_type: 'percentage', default_percentage: 20, variant_name: 'Standard', barcode: '', starting_stock: 30, unit_name: 'Piece', conversion_factor: 1, retail_price: '', wholesale_price: '', cost_price: 300, is_default_sale_unit: 1 },
];

function groupRows(rawRows) {
  const groups = new Map();

  for (const row of rawRows) {
    const key = (row.sku && row.sku.trim()) || (row.name && row.name.trim());
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, {
        name: (row.name || '').trim(),
        sku: (row.sku || '').trim(),
        categoryName: (row.category || '').trim(),
        baseUnitName: (row.base_unit_name || '').trim() || 'Piece',
        minStockAlert: (row.min_stock_alert || '').trim() || '0',
        deadStockDays: (row.dead_stock_days || '').trim(),
        pricingType: ((row.pricing_type || '').trim() || 'fixed').toLowerCase(),
        defaultPercentage: (row.default_percentage || '').trim(),
        variantsMap: new Map(),
        unitsMap: new Map(),
      });
    }

    const g = groups.get(key);
    const variantName = (row.variant_name || '').trim() || 'Standard';
    if (!g.variantsMap.has(variantName)) {
      g.variantsMap.set(variantName, {
        variantName,
        barcode: (row.barcode || '').trim(),
        startingStock: (row.starting_stock || '').trim() || '0',
      });
    }

    const unitName = (row.unit_name || '').trim();
    if (unitName && !g.unitsMap.has(unitName)) {
      g.unitsMap.set(unitName, {
        unitName,
        conversionFactor: (row.conversion_factor || '').trim() || '1',
        retailPrice: (row.retail_price || '').trim() || '0',
        wholesalePrice: (row.wholesale_price || '').trim() || '0',
        costPrice: (row.cost_price || '').trim() || '0',
        isDefaultSaleUnit: /^(1|true|yes)$/i.test((row.is_default_sale_unit || '').trim()),
      });
    }
  }

  return [...groups.values()].map((g) => ({ ...g, variants: [...g.variantsMap.values()], units: [...g.unitsMap.values()] }));
}

async function validateGroups(rawGroups, categories) {
  const skuCounts = {};
  for (const g of rawGroups) if (g.sku) skuCounts[g.sku] = (skuCounts[g.sku] || 0) + 1;

  const barcodeCounts = {};
  for (const g of rawGroups) for (const v of g.variants) if (v.barcode) barcodeCounts[v.barcode] = (barcodeCounts[v.barcode] || 0) + 1;

  const validated = [];
  for (const g of rawGroups) {
    const errors = [];
    if (!g.name) errors.push('The product name is missing.');

    let categoryId = null;
    if (g.categoryName) {
      const match = categories.find((c) => c.name.toLowerCase() === g.categoryName.toLowerCase());
      if (!match) errors.push(`There is no category called "${g.categoryName}". Add it under Categories first, or fix the spelling.`);
      else categoryId = match.id;
    }

    if (!['fixed', 'percentage'].includes(g.pricingType)) errors.push(`pricing_type must be "fixed" or "percentage", not "${g.pricingType}".`);

    if (g.sku) {
      if (skuCounts[g.sku] > 1) errors.push(`Item code "${g.sku}" is used by more than one product in this file.`);
      const res = await window.api.products.checkSkuUnique({ sku: g.sku });
      if (!res.available) errors.push(`Item code "${g.sku}" is already used by a product in the shop.`);
    }

    for (const v of g.variants) {
      if (v.barcode) {
        if (barcodeCounts[v.barcode] > 1) errors.push(`Barcode "${v.barcode}" appears more than once in this file.`);
        const res = await window.api.products.checkBarcodeUnique({ barcode: v.barcode });
        if (!res.available) errors.push(`Barcode "${v.barcode}" is already used by another item.`);
      }
      if (Number.isNaN(Number(v.startingStock))) errors.push(`Starting stock for Type "${v.variantName}" is not a number.`);
    }

    if (g.units.length === 0) errors.push('No pack sizes found — fill in unit_name on at least one row.');
    for (const u of g.units) {
      if ([u.conversionFactor, u.retailPrice, u.wholesalePrice, u.costPrice].some((n) => Number.isNaN(Number(n)))) {
        errors.push(`Pack size "${u.unitName}" has a price or "contains" value that is not a number.`);
      }
    }

    validated.push({ ...g, categoryId, errors });
  }
  return validated;
}

function buildPayload(g) {
  return {
    name: g.name,
    sku: g.sku || null,
    categoryId: g.categoryId,
    supplierId: null,
    baseUnitName: g.baseUnitName,
    isActive: true,
    notes: null,
    minStockAlert: Number(g.minStockAlert) || 0,
    deadStockDays: g.deadStockDays === '' ? null : Number(g.deadStockDays),
    pricingType: g.pricingType,
    defaultPercentage: g.pricingType === 'percentage' ? Number(g.defaultPercentage) || 0 : null,
    isAgencyItem: false,
    variants: g.variants.map((v) => ({
      variantName: v.variantName,
      barcode: v.barcode || null,
      startingStock: Number(v.startingStock) || 0,
    })),
    units: g.units.map((u) => ({
      unitName: u.unitName,
      conversionFactor: Number(u.conversionFactor) || 1,
      retailPrice: Number(u.retailPrice) || 0,
      wholesalePrice: Number(u.wholesalePrice) || 0,
      costPrice: Number(u.costPrice) || 0,
      isDefaultSaleUnit: u.isDefaultSaleUnit,
    })),
    standardStartingStock: 0,
  };
}

const STEPS = ['Upload', 'Check', 'Import'];

export default function BulkImport({ onNavigate, onDone }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [parseError, setParseError] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null); // null while importing
  const fileInputRef = useRef(null);
  const importingRef = useRef(false);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  function handleDownloadTemplate() {
    downloadCsv('product-import-template.csv', toCsv(TEMPLATE_HEADERS, TEMPLATE_ROWS));
  }

  async function handleFile(file) {
    setParseError('');
    if (!/\.csv$/i.test(file.name)) {
      setParseError('Please choose a .csv file.');
      return;
    }

    setChecking(true);
    try {
      const text = await file.text();
      const rawRows = parseCsv(text);
      if (rawRows.length === 0) {
        setParseError('No rows found in that file.');
        return;
      }

      const rawGroups = groupRows(rawRows);
      if (rawGroups.length === 0) {
        setParseError('No products found — every row needs a name or item code.');
        return;
      }
      const validated = await validateGroups(rawGroups, categories);
      setGroups(validated);
      setStep('preview');
    } catch {
      setParseError("That file couldn't be read. Check it is a CSV file and try again.");
    } finally {
      setChecking(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) handleFile(file);
  }

  async function handleConfirm() {
    if (importingRef.current) return;
    importingRef.current = true;
    setResult(null);
    setStep('done');
    const products = groups.map(buildPayload);
    const res = await window.api.products.bulkImport({ products });
    importingRef.current = false;
    setResult(res);
  }

  function reset() {
    setGroups([]);
    setResult(null);
    setParseError('');
    setStep('upload');
  }

  const current = step === 'upload' ? 0 : step === 'preview' ? 1 : result?.success ? 3 : 2;

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', paddingBottom: theme.spacing.xxl }}>
      <Stepper steps={STEPS} current={current} style={{ marginBottom: theme.spacing.lg }} />

      {step === 'upload' && (
        <UploadStep
          fileInputRef={fileInputRef}
          onFileChange={handleFileChange}
          onDropFile={handleFile}
          onDownloadTemplate={handleDownloadTemplate}
          checking={checking}
          error={parseError}
        />
      )}

      {step === 'preview' && <CheckStep groups={groups} onImport={handleConfirm} onChooseAnother={reset} />}

      {step === 'done' && (
        <ImportStep
          result={result}
          onViewProducts={() => {
            reset();
            onDone ? onDone() : onNavigate('/products');
          }}
          onImportMore={reset}
          onBackToCheck={() => {
            setResult(null);
            setStep('preview');
          }}
        />
      )}
    </div>
  );
}
