import React, { useEffect, useState } from 'react';
import { Field, Select } from '../../components/ui';
import ExportButtons from './components/ExportButtons';
import ReportShell from './parts/ReportShell';
import { useReportData } from './parts/reportUtils';
import { StockSummary, StockByCategory, StockTable } from './parts/StockReportParts';

export default function StockReport() {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  const filters = { categoryId: categoryId ? Number(categoryId) : null };

  const { data, loading, error, retry } = useReportData(() => window.api.reports.getStockReport({ filters }), [categoryId]);

  return (
    <ReportShell
      intro="What's on your shelves, and what it's worth."
      filters={
        <Field label="Category" style={{ marginBottom: 0 }}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: '220px' }}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      }
      exportAction={<ExportButtons rows={data?.rows || []} columns={data?.columns || []} reportType="stock" filters={filters} suggestedName="stock-report.csv" />}
      loading={loading}
      error={error}
      onRetry={retry}
      isEmpty={!!data && data.rows.length === 0}
      emptyHint="No products to show. Try a different category."
      summary={data && <StockSummary summary={data.summary} />}
      footnotes={["Stock value uses the buying price of each item's smallest pack size."]}
    >
      {data && (
        <>
          <StockByCategory chartData={data.chartData} />
          <StockTable columns={data.columns} rows={data.rows} />
        </>
      )}
    </ReportShell>
  );
}
