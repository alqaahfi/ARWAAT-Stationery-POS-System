import React, { useEffect, useRef, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, Button, TextInput, Select, tableStyles, Tr } from '../../components/ui';
import { formatCount, formatDateTime } from '../../utils/format';

const TYPE_LABELS = {
  purchase: 'Purchase',
  sale: 'Sale',
  return_in: 'Return In',
  return_out: 'Return Out',
  adjustment: 'Adjustment',
};

const TYPE_TONE = {
  purchase: { color: theme.colors.success, bg: theme.colors.successBackground },
  sale: { color: theme.colors.info, bg: theme.colors.infoBackground },
  return_in: { color: theme.colors.warning, bg: theme.colors.warningBackground },
  return_out: { color: theme.colors.warning, bg: theme.colors.warningBackground },
  adjustment: { color: theme.colors.accentPurple, bg: theme.colors.appBackground },
};

// The reference_type/reference_id pair on a movement row only makes sense
// resolved together with the joined purchase/sale it points at — this is the
// one place that turns them into a readable string.
function referenceLabel(r) {
  if (r.reference_type === 'purchase') return r.purchase_reference_no ? `Purchase ${r.purchase_reference_no}` : `Purchase #${r.reference_id}`;
  if (r.reference_type === 'sale') return r.sale_invoice_no ? `Sale ${r.sale_invoice_no}` : `Sale #${r.reference_id}`;
  if (r.reference_type === 'initial_stock') return 'Initial Stock';
  if (r.reference_type === 'adjustment') return r.note || 'Manual Adjustment';
  return r.note || '—';
}

// Route: /products/stock-movements. Read-only view over stock_movements —
// already populated by every purchase, sale and adjustment.
//
// Accepts an optional productId (the All Products page's "View Movement
// History" action pre-fills it) as the initial filter; it can still be
// cleared to see movements across every product.
export default function MovementHistory({ productId }) {
  const [product, setProduct] = useState(null);
  const [filterProductId, setFilterProductId] = useState(productId || null);
  const [movementType, setMovementType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ rows: [], limit: 0 });
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (productId) {
      window.api.products.getById({ id: productId }).then(setProduct);
    }
  }, [productId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProductId, movementType, dateFrom, dateTo]);

  async function load(searchOverride) {
    setLoading(true);
    const data = await window.api.stock.getMovements({
      productId: filterProductId || null,
      movementType: movementType || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      search: (searchOverride !== undefined ? searchOverride : search) || null,
    });
    setResult(data);
    setLoading(false);
  }

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  function clearProductFilter() {
    setProduct(null);
    setFilterProductId(null);
  }

  return (
    <div>
      <PageHeader title="Stock Movement History" />

      {product && (
        <Card style={{ marginBottom: theme.spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            Filtered to <strong>{product.name}</strong>
          </div>
          <Button variant="ghost" onClick={clearProductFilter}>
            Clear Filter
          </Button>
        </Card>
      )}

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          {!product && (
            <TextInput
              placeholder="Search product name or SKU…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{ flex: 1, minWidth: '200px' }}
            />
          )}
          <Select value={movementType} onChange={(e) => setMovementType(e.target.value)} style={{ width: '170px' }}>
            <option value="">All Types</option>
            {Object.entries(TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </Select>
          <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '160px' }} />
          <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '160px' }} />
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Product</th>
                <th style={tableStyles.th}>Variant</th>
                <th style={tableStyles.th}>Type</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Quantity</th>
                <th style={tableStyles.th}>Reference</th>
                <th style={tableStyles.th}>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => {
                const tone = TYPE_TONE[r.movement_type] || TYPE_TONE.adjustment;
                return (
                  <Tr key={r.id}>
                    <td style={tableStyles.td}>{formatDateTime(r.created_at)}</td>
                    <td style={tableStyles.td}>{r.product_name}</td>
                    <td style={tableStyles.td}>{r.variant_name}</td>
                    <td style={tableStyles.td}>
                      <span style={{ ...styles.badge, color: tone.color, backgroundColor: tone.bg }}>
                        {TYPE_LABELS[r.movement_type] || r.movement_type}
                      </span>
                    </td>
                    <td
                      style={{
                        ...tableStyles.td,
                        textAlign: 'right',
                        fontWeight: theme.font.weightMedium,
                        color: r.quantity > 0 ? theme.colors.success : theme.colors.danger,
                      }}
                    >
                      {r.quantity > 0 ? '+' : ''}
                      {formatCount(r.quantity)} {r.base_unit_name}
                    </td>
                    <td style={tableStyles.td}>{referenceLabel(r)}</td>
                    <td style={tableStyles.td}>{r.created_by_name || '—'}</td>
                  </Tr>
                );
              })}
              {!loading && result.rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={tableStyles.emptyState}>
                    No stock movements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {result.rows.length === result.limit && (
          <div style={styles.capNotice}>Showing the latest {result.limit} movements — narrow the filters above to see older history.</div>
        )}
      </Card>
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    fontSize: theme.font.sizeXs,
    fontWeight: theme.font.weightMedium,
  },
  capNotice: {
    padding: '10px 14px',
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    borderTop: `1px solid ${theme.colors.border}`,
  },
};
