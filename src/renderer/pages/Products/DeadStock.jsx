import React, { useCallback, useEffect, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { EmptyState } from '../../components/ui';
import { formatCount, formatDateOnly } from '../../utils/format';
import { StockIntro } from './stock/StockIntro';
import { StockTable, TwoLine } from './stock/StockTable';

const muted = { color: theme.colors.labelSecondary };

// Rows come straight from Product.js (via products:get-dead-stock).
const columns = [
  { key: 'name', label: 'Product', render: (r) => <TwoLine title={r.name} sub={r.category_name || 'No category'} /> },
  { key: 'total_stock', label: 'In stock', numeric: true, width: '100px', render: (r) => formatCount(r.total_stock) },
  {
    key: 'last_sold_at',
    label: 'Last sold',
    width: '140px',
    render: (r) => (r.last_sold_at ? formatDateOnly(r.last_sold_at) : <span style={muted}>{glossary.neverSold}</span>),
  },
  {
    key: 'days',
    label: 'Days without a sale',
    numeric: true,
    width: '160px',
    render: (r) => (r.last_sold_at ? formatCount(r.days_since_last_sale) : <span style={muted}>—</span>),
  },
  { key: 'dead_stock_days', label: 'Flag after (days)', numeric: true, width: '140px', render: (r) => formatCount(r.dead_stock_days) },
];

export default function DeadStock({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setRows(await window.api.products.getDeadStock());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <StockIntro>Items that haven't sold for longer than you chose. Think about a discount, or stop reordering.</StockIntro>
      <StockTable
        columns={columns}
        rows={rows}
        loading={loading}
        error={error}
        onRetry={load}
        footnote={rows.length > 0 && `${formatCount(rows.length)} items`}
        onRowClick={(r) => onNavigate('/products/edit', { id: r.id })}
        emptyState={
          <EmptyState
            icon={CircleCheck}
            color="green"
            title="Everything is selling"
            message={`Items appear here only when you set '${glossary.notSellingDays}' on the product.`}
          />
        }
      />
    </div>
  );
}
