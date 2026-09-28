import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, SearchX } from 'lucide-react';
import theme from '../../config/theme';
import { Button, EmptyState } from '../../components/ui';
import { StockIntro } from './stock/StockIntro';
import { StockTable } from './stock/StockTable';
import { HistoryToolbar, historyColumns } from './stock/HistoryParts';

// Route: /products/stock-movements. Read-only view over stock_movements —
// already populated by every purchase, sale and adjustment.
//
// Accepts an optional productId (the All Products page's "Stock History"
// action pre-fills it) as the initial filter; it can still be cleared to see
// movements across every product.
export default function MovementHistory({ productId }) {
  const [product, setProduct] = useState(null);
  const [filterProductId, setFilterProductId] = useState(productId || null);
  const [movementType, setMovementType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState({ rows: [], limit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const debounceRef = useRef(null);
  const seq = useRef(0);

  useEffect(() => {
    if (productId) {
      window.api.products.getById({ id: productId }).then(setProduct, () => setProduct(null));
    }
  }, [productId]);

  const load = useCallback(
    async (searchValue) => {
      const mine = ++seq.current;
      setLoading(true);
      setError(false);
      try {
        const data = await window.api.stock.getMovements({
          productId: filterProductId || null,
          movementType: movementType || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          search: searchValue || null,
        });
        if (mine === seq.current) setResult(data);
      } catch {
        if (mine === seq.current) setError(true);
      }
      if (mine === seq.current) setLoading(false);
    },
    [filterProductId, movementType, dateFrom, dateTo]
  );

  // Filters reload at once; the search box is debounced like before.
  const searchRef = useRef(search);
  searchRef.current = search;
  useEffect(() => {
    load(searchRef.current);
  }, [load]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  function clearProductFilter() {
    setProduct(null);
    setFilterProductId(null);
  }

  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearch('');
    setMovementType('');
    setDateFrom('');
    setDateTo('');
    clearProductFilter();
    if (!filterProductId && !movementType && !dateFrom && !dateTo) load('');
  }

  const filtered = !!(filterProductId || movementType || dateFrom || dateTo || search.trim());
  const capped = result.limit > 0 && result.rows.length >= result.limit;

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <StockIntro>Every time your stock went up or down, and why.</StockIntro>
      <HistoryToolbar
        productName={filterProductId ? product?.name || 'Loading…' : null}
        onClearProduct={clearProductFilter}
        search={search}
        onSearch={handleSearchChange}
        movementType={movementType}
        onMovementType={setMovementType}
        dateFrom={dateFrom}
        onDateFrom={setDateFrom}
        dateTo={dateTo}
        onDateTo={setDateTo}
      />
      <StockTable
        columns={historyColumns}
        rows={result.rows}
        loading={loading}
        error={error}
        onRetry={() => load(search)}
        emptyState={
          filtered ? (
            <EmptyState icon={SearchX} title="Nothing matches" message="No stock changes match these filters." action={<Button variant="tinted" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={History} title="No stock changes yet" message="Purchases, sales, returns and fixes will show up here." />
          )
        }
        below={
          capped &&
          !loading && (
            <div style={{ ...theme.type.footnote, color: theme.colors.labelSecondary, padding: '10px 14px' }}>
              Showing the latest {result.limit} changes. Use the filters to narrow it down.
            </div>
          )
        }
      />
    </div>
  );
}
