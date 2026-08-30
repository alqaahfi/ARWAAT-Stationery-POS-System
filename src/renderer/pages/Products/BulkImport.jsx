import React, { useEffect, useRef, useState } from 'react';
import { Card, PageHeader, Button, Banner, tableStyles } from '../../components/ui';
import theme from '../../config/theme';
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
    if (!g.name) errors.push('Missing product name.');

    let categoryId = null;
    if (g.categoryName) {
      const match = categories.find((c) => c.name.toLowerCase() === g.categoryName.toLowerCase());
      if (!match) errors.push(`Unknown category "${g.categoryName}".`);
      else categoryId = match.id;
    }

    if (!['fixed', 'percentage'].includes(g.pricingType)) errors.push(`Invalid pricing_type "${g.pricingType}".`);

    if (g.sku) {
      if (skuCounts[g.sku] > 1) errors.push(`SKU "${g.sku}" appears more than once in this file.`);
      const res = await window.api.products.checkSkuUnique({ sku: g.sku });
      if (!res.available) errors.push(`SKU "${g.sku}" already exists.`);
    }

    for (const v of g.variants) {
      if (v.barcode) {
        if (barcodeCounts[v.barcode] > 1) errors.push(`Barcode "${v.barcode}" appears more than once in this file.`);
        const res = await window.api.products.checkBarcodeUnique({ barcode: v.barcode });
        if (!res.available) errors.push(`Barcode "${v.barcode}" already exists.`);
      }
      if (Number.isNaN(Number(v.startingStock))) errors.push(`Invalid starting_stock for variant "${v.variantName}".`);
    }

    if (g.units.length === 0) errors.push('No unit rows found for this product.');
    for (const u of g.units) {
      if ([u.conversionFactor, u.retailPrice, u.wholesalePrice, u.costPrice].some((n) => Number.isNaN(Number(n)))) {
        errors.push(`Invalid numeric value in unit "${u.unitName}".`);
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

export default function BulkImport({ onNavigate, onDone }) {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [categories, setCategories] = useState([]);
  const [groups, setGroups] = useState([]);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  function handleDownloadTemplate() {
    downloadCsv('product-import-template.csv', toCsv(TEMPLATE_HEADERS, TEMPLATE_ROWS));
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setParseError('');

    const text = await file.text();
    const rawRows = parseCsv(text);
    if (rawRows.length === 0) {
      setParseError('No rows found in that file.');
      return;
    }

    const rawGroups = groupRows(rawRows);
    const validated = await validateGroups(rawGroups, categories);
    setGroups(validated);
    setStep('preview');
    e.target.value = '';
  }

  async function handleConfirm() {
    setImporting(true);
    const products = groups.map(buildPayload);
    const res = await window.api.products.bulkImport({ products });
    setImporting(false);
    setResult(res);
    setStep('done');
  }

  function reset() {
    setGroups([]);
    setResult(null);
    setParseError('');
    setStep('upload');
  }

  const totalErrors = groups.reduce((sum, g) => sum + g.errors.length, 0);

  return (
    <div>
      <PageHeader title="Bulk Import Products" />

      {step === 'upload' && (
        <Card>
          <p style={{ color: theme.colors.textSecondary, fontSize: '14px', marginTop: 0 }}>
            Import many products at once from a CSV file. Each variant/unit combination is one row —
            rows sharing the same SKU (or name, if SKU is blank) are grouped back into one product.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={handleDownloadTemplate}>
              Download CSV Template
            </Button>
            <Button onClick={() => fileInputRef.current.click()}>Upload CSV</Button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
          <Banner>{parseError}</Banner>
        </Card>
      )}

      {step === 'preview' && (
        <>
          <Banner tone={totalErrors > 0 ? 'error' : 'info'}>
            {groups.length} product{groups.length === 1 ? '' : 's'} found.{' '}
            {totalErrors > 0
              ? `Fix ${totalErrors} error${totalErrors === 1 ? '' : 's'} before importing — nothing is written until every row is valid.`
              : 'No errors found — ready to import.'}
          </Banner>

          <Card style={{ padding: 0, marginTop: '16px' }}>
            <div style={tableStyles.scroll}>
              <table style={tableStyles.table}>
                <thead>
                  <tr>
                    <th style={tableStyles.th}>Product</th>
                    <th style={tableStyles.th}>SKU</th>
                    <th style={tableStyles.th}>Category</th>
                    <th style={tableStyles.th}>Pricing</th>
                    <th style={tableStyles.th}>Variants</th>
                    <th style={tableStyles.th}>Units</th>
                    <th style={tableStyles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => (
                    <tr key={i}>
                      <td style={tableStyles.td}>{g.name || <span style={{ color: theme.colors.danger }}>(missing)</span>}</td>
                      <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{g.sku || '—'}</td>
                      <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{g.categoryName || '—'}</td>
                      <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>{g.pricingType}</td>
                      <td style={tableStyles.td}>{g.variants.length}</td>
                      <td style={tableStyles.td}>{g.units.length}</td>
                      <td style={tableStyles.td}>
                        {g.errors.length === 0 ? (
                          <span style={{ color: theme.colors.success }}>● OK</span>
                        ) : (
                          <div>
                            {g.errors.map((err, j) => (
                              <div key={j} style={{ color: theme.colors.danger, fontSize: '12px' }}>
                                ● {err}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
            <Button onClick={handleConfirm} disabled={totalErrors > 0 || importing}>
              {importing ? 'Importing…' : 'Confirm Import'}
            </Button>
            <Button variant="ghost" onClick={reset}>
              Start Over
            </Button>
          </div>
        </>
      )}

      {step === 'done' && (
        <Card>
          {result?.success ? (
            <>
              <p style={{ color: theme.colors.success, fontSize: '15px' }}>
                ✔ Imported {result.results.length} product{result.results.length === 1 ? '' : 's'} successfully.
              </p>
              <Button
                onClick={() => {
                  reset();
                  onDone ? onDone() : onNavigate('/products');
                }}
              >
                Done
              </Button>
            </>
          ) : (
            <>
              <p style={{ color: theme.colors.danger, fontSize: '15px' }}>Import failed — nothing was saved: {result?.reason}</p>
              <Button variant="ghost" onClick={reset}>
                Back
              </Button>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
