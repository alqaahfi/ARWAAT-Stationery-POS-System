import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, Plus, SearchX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, useConfirm, useToast } from '../../components/ui';
import { ProductToolbar, StatusChips } from './list/ProductToolbar';
import { ProductCards, ProductTable, SkeletonRows } from './list/ProductRows';
import { BulkBar } from './list/BulkBar';
import { statusLabel } from './list/StatusBadges';
import useRememberedState from '../../utils/useRememberedState';

const VIEW_MODE_KEY = 'pos_product_view_mode';
const SORT_PREFS_KEY = 'pos_product_sort_prefs';

function loadSortPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_PREFS_KEY));
    return { sortBy: saved?.sortBy || 'name', sortDirection: saved?.sortDirection || 'asc' };
  } catch {
    return { sortBy: 'name', sortDirection: 'asc' };
  }
}

// Remembers selection/scroll state across a full unmount (opening a profile
// and coming back) — module-scope so it survives this component remounting,
// but resets on a real app restart since it's not persisted to storage.
let rememberedState = null;

// Clicking a row opens that product's profile page (/products/profile).
export default function ProductList({ onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const toast = useToast();
  const confirm = useConfirm();

  const containerRef = useRef(null);
  const latestRef = useRef({ selectedIds: new Set() });

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_KEY) || 'list');
  const [sortPrefs, setSortPrefs] = useState(loadSortPrefs);

  const [search, setSearch] = useRememberedState('productList.search', '');
  const [categoryId, setCategoryId] = useRememberedState('productList.categoryId', '');
  const [lowStockOnly, setLowStockOnly] = useRememberedState('productList.lowStockOnly', false);
  const [deadStockOnly, setDeadStockOnly] = useRememberedState('productList.deadStockOnly', false);
  const [outOfStockOnly, setOutOfStockOnly] = useRememberedState('productList.outOfStockOnly', false);
  const [activeFilter, setActiveFilter] = useRememberedState('productList.activeFilter', 'all');

  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ rows: [], counts: { all: 0, lowStock: 0, deadStock: 0, outOfStock: 0 } });
  const [loading, setLoading] = useState(true);

  const [selectedIds, setSelectedIds] = useState(() => rememberedState?.selectedIds || new Set());

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(SORT_PREFS_KEY, JSON.stringify(sortPrefs));
  }, [sortPrefs]);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  // Restore scroll position once on mount; remember it (plus selection state)
  // on unmount so opening a profile and coming back lands where you left off.
  useEffect(() => {
    if (rememberedState?.scrollTop && containerRef.current) {
      containerRef.current.scrollTop = rememberedState.scrollTop;
    }
    return () => {
      rememberedState = {
        selectedIds: latestRef.current.selectedIds,
        scrollTop: containerRef.current ? containerRef.current.scrollTop : 0,
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latestRef.current = { selectedIds };
  }, [selectedIds]);

  // One debounced effect for every filter/sort input — a plain function
  // recreated each render (closing over current state), so the timeout that
  // actually survives to fire always reflects the latest values, not a stale
  // closure from an earlier keystroke.
  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, lowStockOnly, deadStockOnly, outOfStockOnly, activeFilter, sortPrefs]);

  function load() {
    setLoading(true);
    window.api.products
      .list({
        search: search.trim() || null,
        categoryId: categoryId ? Number(categoryId) : null,
        lowStockOnly,
        deadStockOnly,
        outOfStockOnly,
        activeFilter,
        sortBy: sortPrefs.sortBy,
        sortDirection: sortPrefs.sortDirection,
      })
      .then((res) => {
        setData(res);
        setLoading(false);
      });
  }

  // Row callbacks are handed to memoized rows, so they must stay stable
  // across renders; these refs let them read current values anyway.
  const loadRef = useRef(load);
  loadRef.current = load;
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  const actions = useMemo(
    () => ({
      open(id) {
        navigateRef.current('/products/profile', { id });
      },
      toggleSelect(id) {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      async toggleActive(product) {
        await window.api.products.setActive({ id: product.id, isActive: !product.is_active });
        loadRef.current();
      },
    }),
    []
  );

  function clickChip(chip) {
    setLowStockOnly(chip === 'low');
    setDeadStockOnly(chip === 'dead');
    setOutOfStockOnly(chip === 'outOfStock');
  }

  const activeChip = outOfStockOnly ? 'outOfStock' : deadStockOnly && !lowStockOnly ? 'dead' : lowStockOnly && !deadStockOnly ? 'low' : lowStockOnly && deadStockOnly ? null : 'all';
  const filtersActive = !!search.trim() || !!categoryId || activeFilter !== 'all' || activeChip !== 'all';

  function clearFilters() {
    setSearch('');
    setCategoryId('');
    setActiveFilter('all');
    clickChip('all');
  }

  async function handleBulkDeactivate() {
    const n = selectedIds.size;
    const ok = await confirm({
      title: `Deactivate ${n} product${n === 1 ? '' : 's'}?`,
      message: 'They will be hidden from sales. You can turn them back on any time.',
      confirmLabel: 'Deactivate',
      destructive: true,
    });
    if (!ok) return;
    const res = await window.api.products.bulkSetActive({ ids: [...selectedIds], isActive: false });
    if (res && res.success === false) {
      toast.error(res.reason || 'Could not deactivate the products.');
      return;
    }
    setSelectedIds(new Set());
    toast.success(`${n} product${n === 1 ? '' : 's'} deactivated`);
    load();
  }

  async function handleBulkReassignCategory(bulkCategoryId) {
    if (!bulkCategoryId) return;
    const n = selectedIds.size;
    const res = await window.api.products.bulkSetCategory({ ids: [...selectedIds], categoryId: Number(bulkCategoryId) });
    if (res && res.success === false) {
      toast.error(res.reason || 'Could not move the products.');
      return;
    }
    setSelectedIds(new Set());
    toast.success(`${n} product${n === 1 ? '' : 's'} moved`);
    load();
  }

  async function handleExportCsv() {
    setExporting(true);
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: glossary.itemCode },
      { key: 'category_name', label: 'Category' },
      { key: 'total_stock', label: 'Stock' },
      { key: 'base_unit_name', label: glossary.smallestUnit },
      { key: 'status', label: 'Status' },
      { key: 'is_active', label: 'Active' },
    ];
    const rows = data.rows.map((r) => ({ ...r, status: statusLabel(r), is_active: r.is_active ? 'Yes' : 'No' }));
    const res = await window.api.reports.exportCsv({ rows, columns, suggestedName: 'products.csv' });
    setExporting(false);
    if (res.canceled) return;
    if (res.success) toast.success('List exported');
    else toast.error(res.reason || 'Could not export the list.');
  }

  function toggleSortDirection() {
    setSortPrefs((prev) => ({ ...prev, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }));
  }

  let content;
  if (loading && data.rows.length === 0) {
    content = <SkeletonRows />;
  } else if (data.rows.length === 0 && !filtersActive) {
    content = (
      <Card>
        <EmptyState
          {...appIcons.products}
          title="No products yet"
          message={isAdmin ? 'Add the items you sell, one by one or all at once from a spreadsheet.' : undefined}
          action={
            isAdmin && (
              <div style={{ display: 'flex', gap: theme.spacing.sm, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button icon={Plus} onClick={() => onNavigate('/products/new')}>
                  Add your first product
                </Button>
                <Button variant="plain" icon={FileSpreadsheet} onClick={() => onNavigate('/products/bulk-import')}>
                  {glossary.importSpreadsheet}
                </Button>
              </div>
            )
          }
        />
      </Card>
    );
  } else if (data.rows.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={SearchX}
          title="No products match"
          message="Try a different search or filter."
          action={
            <Button variant="tinted" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      </Card>
    );
  } else {
    content =
      viewMode === 'grid' ? (
        <ProductCards rows={data.rows} actions={actions} />
      ) : (
        <ProductTable rows={data.rows} isAdmin={isAdmin} actions={actions} compact={viewMode === 'compact'} selectedIds={selectedIds} />
      );
  }

  return (
    <div ref={containerRef} style={{ height: '100%', overflowY: 'auto', paddingBottom: theme.spacing.xxl, boxSizing: 'border-box' }}>
      <ProductToolbar
        search={search}
        onSearch={setSearch}
        categories={categories}
        categoryId={categoryId}
        onCategory={setCategoryId}
        activeFilter={activeFilter}
        onActiveFilter={setActiveFilter}
        sortBy={sortPrefs.sortBy}
        sortDirection={sortPrefs.sortDirection}
        onSortBy={(sortBy) => setSortPrefs((prev) => ({ ...prev, sortBy }))}
        onToggleDirection={toggleSortDirection}
        viewMode={viewMode}
        onViewMode={setViewMode}
        isAdmin={isAdmin}
        onAdd={() => onNavigate('/products/new')}
        onImport={() => onNavigate('/products/bulk-import')}
        onExport={handleExportCsv}
        exporting={exporting}
      />
      <StatusChips active={activeChip} counts={data.counts} onChange={clickChip} shownCount={data.rows.length} loading={loading} />

      <div style={{ marginTop: theme.spacing.md, opacity: loading && data.rows.length > 0 ? 0.6 : 1, transition: `opacity ${theme.motion.fast} ease` }}>{content}</div>

      {isAdmin && selectedIds.size > 0 && (
        <BulkBar
          count={selectedIds.size}
          categories={categories}
          onMoveToCategory={handleBulkReassignCategory}
          onDeactivate={handleBulkDeactivate}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  );
}
