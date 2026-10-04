import React, { useCallback, useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Badge, EmptyState } from '../../components/ui';
import { formatCount } from '../../utils/format';
import { StockIntro } from './stock/StockIntro';
import { StockTable, TwoLine } from './stock/StockTable';

// Rows come straight from Product.js (via products:get-low-stock) — the same
// rule the Product List chips use. No prices here: cashiers can open this page.
const columns = [
  { key: 'name', label: 'Product', render: (r) => <TwoLine title={r.name} sub={r.category_name || 'No category'} /> },
  { key: 'total_stock', label: 'In stock', numeric: true, width: '110px', render: (r) => formatCount(r.total_stock) },
  { key: 'min_stock_alert', label: 'Warn below', numeric: true, width: '110px', render: (r) => formatCount(r.min_stock_alert) },
  {
    key: 'deficit',
    label: 'Short by',
    numeric: true,
    width: '110px',
    render: (r) => <span style={{ color: theme.colors.orangeText, fontWeight: theme.font.weightSemibold }}>{formatCount(r.deficit)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '140px',
    render: (r) =>
      Number(r.total_stock) === 0 ? <Badge tone="red">{glossary.outOfStock}</Badge> : <Badge tone="orange">{glossary.runningLow}</Badge>,
  },
];

export default function LowStock({ onNavigate }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await window.api.products.getLowStock());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const outCount = rows.filter((r) => Number(r.total_stock) === 0).length;

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <StockIntro>Items at or below the level you set. Reorder these soon.</StockIntro>
      <StockTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        footnote={rows.length > 0 && `${formatCount(rows.length)} items · ${formatCount(outCount)} out of stock`}
        onRowClick={(r) => onNavigate('/products/profile', { id: r.id })}
        emptyState={<EmptyState icon={CircleCheck} color="green" title="Nothing is running low" message="All your items are above their warning level." />}
      />
    </div>
  );
}
