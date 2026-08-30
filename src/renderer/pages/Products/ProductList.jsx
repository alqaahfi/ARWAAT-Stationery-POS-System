import React, { useEffect, useRef, useState } from 'react';
import { List, LayoutGrid, Rows3, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, Select, Checkbox, tableStyles, Tr } from '../../components/ui';
import { formatCount, formatCurrency, formatDateTime } from '../../utils/format';

const VIEW_MODE_KEY = 'pos_product_view_mode';
const SORT_PREFS_KEY = 'pos_product_sort_prefs';

const SORT_OPTIONS = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'total_stock', label: 'Total Stock' },
  { key: 'category', label: 'Category' },
  { key: 'created_at', label: 'Recently Added' },
  { key: 'updated_at', label: 'Recently Updated' },
];

function loadSortPrefs() {
  try {
    const saved = JSON.parse(localStorage.getItem(SORT_PREFS_KEY));
    return { sortBy: saved?.sortBy || 'name', sortDirection: saved?.sortDirection || 'asc' };
  } catch {
    return { sortBy: 'name', sortDirection: 'asc' };
  }
}

function statusLabel(row) {
  const labels = [];
  if (row.isOutOfStock) labels.push('Out of Stock');
  else if (row.isLow) labels.push('Low Stock');
  if (row.isDead) labels.push('Dead Stock');
  return labels.length ? labels.join(', ') : 'Normal';
}

// Remembers expand/selection/scroll state across a full unmount (navigating
// to Edit and back) — module-scope so it survives this component remounting,
// but resets on a real app restart since it's not persisted to storage.
let rememberedState = null;

export default function ProductList({ onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const containerRef = useRef(null);
  const latestRef = useRef({ expandedIds: new Set(), selectedIds: new Set() });

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_MODE_KEY) || 'list');
  const [sortPrefs, setSortPrefs] = useState(loadSortPrefs);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [deadStockOnly, setDeadStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ rows: [], counts: { all: 0, lowStock: 0, deadStock: 0, outOfStock: 0 } });
  const [loading, setLoading] = useState(true);

  const [expandedIds, setExpandedIds] = useState(() => rememberedState?.expandedIds || new Set());
  const [selectedIds, setSelectedIds] = useState(() => rememberedState?.selectedIds || new Set());
  const [detailCache, setDetailCache] = useState({});
  const [loadingDetailIds, setLoadingDetailIds] = useState(new Set());

  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(SORT_PREFS_KEY, JSON.stringify(sortPrefs));
  }, [sortPrefs]);

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  // Restore scroll position once on mount; remember it (plus expand/selection
  // state) on unmount so navigating to Edit and back lands where you left off.
  useEffect(() => {
    if (rememberedState?.scrollTop && containerRef.current) {
      containerRef.current.scrollTop = rememberedState.scrollTop;
    }
    return () => {
      rememberedState = {
        expandedIds: latestRef.current.expandedIds,
        selectedIds: latestRef.current.selectedIds,
        scrollTop: containerRef.current ? containerRef.current.scrollTop : 0,
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    latestRef.current = { expandedIds, selectedIds };
  }, [expandedIds, selectedIds]);

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

  async function toggleActive(product) {
    await window.api.products.setActive({ id: product.id, isActive: !product.is_active });
    load();
  }

  function toggleExpand(id) {
    const wasExpanded = expandedIds.has(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (wasExpanded) {
        next.delete(id);
      } else {
        if (viewMode !== 'grid') next.clear(); // accordion outside Grid; Grid allows several at once
        next.add(id);
      }
      return next;
    });

    if (!wasExpanded && !detailCache[id]) fetchDetail(id);
  }

  async function fetchDetail(id) {
    setLoadingDetailIds((prev) => new Set(prev).add(id));
    const detail = await window.api.products.getById({ id });
    setDetailCache((prev) => ({ ...prev, [id]: detail }));
    setLoadingDetailIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clickChip(chip) {
    setLowStockOnly(chip === 'low');
    setDeadStockOnly(chip === 'dead');
    setOutOfStockOnly(chip === 'outOfStock');
  }

  const activeChip = outOfStockOnly ? 'outOfStock' : deadStockOnly && !lowStockOnly ? 'dead' : lowStockOnly && !deadStockOnly ? 'low' : lowStockOnly && deadStockOnly ? null : 'all';

  async function handleBulkDeactivate() {
    await window.api.products.bulkSetActive({ ids: [...selectedIds], isActive: false });
    setSelectedIds(new Set());
    load();
  }

  async function handleBulkReassignCategory() {
    if (!bulkCategoryId) return;
    await window.api.products.bulkSetCategory({ ids: [...selectedIds], categoryId: Number(bulkCategoryId) });
    setSelectedIds(new Set());
    setBulkCategoryId('');
    load();
  }

  async function handleExportCsv() {
    setExporting(true);
    setExportMessage('');
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'category_name', label: 'Category' },
      { key: 'total_stock', label: 'Total Stock' },
      { key: 'base_unit_name', label: 'Base Unit' },
      { key: 'status', label: 'Status' },
      { key: 'is_active', label: 'Active' },
    ];
    const rows = data.rows.map((r) => ({ ...r, status: statusLabel(r), is_active: r.is_active ? 'Yes' : 'No' }));
    const res = await window.api.reports.exportCsv({ rows, columns, suggestedName: 'products.csv' });
    setExporting(false);
    if (res.canceled) return;
    setExportMessage(res.success ? 'CSV exported.' : res.reason || 'Could not export CSV.');
  }

  function toggleSortDirection() {
    setSortPrefs((prev) => ({ ...prev, sortDirection: prev.sortDirection === 'asc' ? 'desc' : 'asc' }));
  }

  return (
    <div ref={containerRef} style={{ height: '100%', overflowY: 'auto' }}>
      <PageHeader
        title="Products"
        actions={
          <>
            <Button variant="secondary" onClick={handleExportCsv} disabled={exporting}>
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button variant="secondary" onClick={() => onNavigate('/products/bulk-import')}>
              Bulk Import
            </Button>
            <Button onClick={() => onNavigate('/products/new')}>+ Add New Product</Button>
          </>
        }
      />
      {exportMessage && <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, marginBottom: theme.spacing.sm }}>{exportMessage}</div>}

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU or barcode…"
            style={styles.searchInput}
          />
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: '200px' }}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} style={{ width: '150px' }}>
            <option value="all">All Statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </Select>
        </div>

        <div style={styles.checkboxRow}>
          <Checkbox label="Low Stock only" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} style={{ marginTop: 0 }} />
          <Checkbox label="Dead Stock only" checked={deadStockOnly} onChange={(e) => setDeadStockOnly(e.target.checked)} style={{ marginTop: 0 }} />
        </div>

        <div style={styles.chipRow}>
          <Chip label={`All (${data.counts.all})`} active={activeChip === 'all'} onClick={() => clickChip('all')} />
          <Chip label={`Low Stock (${data.counts.lowStock})`} active={activeChip === 'low'} onClick={() => clickChip('low')} tone="warning" />
          <Chip label={`Dead Stock (${data.counts.deadStock})`} active={activeChip === 'dead'} onClick={() => clickChip('dead')} tone="muted" />
          <Chip label={`Out of Stock (${data.counts.outOfStock})`} active={activeChip === 'outOfStock'} onClick={() => clickChip('outOfStock')} tone="danger" />
        </div>

        <div style={styles.metaRow}>
          <span style={styles.countLabel}>
            {loading ? 'Loading…' : `${data.rows.length} of ${data.counts.all} products shown`}
          </span>

          <div style={styles.metaControls}>
            <Select value={sortPrefs.sortBy} onChange={(e) => setSortPrefs((prev) => ({ ...prev, sortBy: e.target.value }))} style={{ width: '170px' }}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </Select>
            <button style={styles.sortDirBtn} onClick={toggleSortDirection} title="Toggle sort direction">
              {sortPrefs.sortDirection === 'asc' ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
            </button>

            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </Card>

      {selectedIds.size > 0 && (
        <Card style={{ marginBottom: theme.spacing.md, display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
          <span style={{ color: theme.colors.textPrimary, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightMedium }}>
            {selectedIds.size} selected
          </span>
          <Button variant="danger" style={{ padding: '7px 14px', fontSize: theme.font.sizeSm }} onClick={handleBulkDeactivate}>
            Deactivate Selected
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)} style={{ width: '180px' }}>
              <option value="">Reassign to category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button variant="secondary" style={{ padding: '7px 14px', fontSize: theme.font.sizeSm }} disabled={!bulkCategoryId} onClick={handleBulkReassignCategory}>
              Apply
            </Button>
          </div>
          <Button variant="ghost" style={{ padding: '7px 14px', fontSize: theme.font.sizeSm, marginLeft: 'auto' }} onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </Card>
      )}

      {loading && data.rows.length === 0 ? (
        <Card style={{ padding: '32px', textAlign: 'center', color: theme.colors.textSecondary }}>Loading…</Card>
      ) : data.rows.length === 0 ? (
        <Card style={{ padding: '32px', textAlign: 'center', color: theme.colors.textSecondary }}>No products found.</Card>
      ) : viewMode === 'grid' ? (
        <GridView
          rows={data.rows}
          expandedIds={expandedIds}
          selectedIds={selectedIds}
          detailCache={detailCache}
          loadingDetailIds={loadingDetailIds}
          isAdmin={isAdmin}
          onToggleExpand={toggleExpand}
          onToggleSelect={toggleSelect}
          onToggleActive={toggleActive}
          onNavigate={onNavigate}
        />
      ) : (
        <TableView
          compact={viewMode === 'compact'}
          rows={data.rows}
          expandedIds={expandedIds}
          selectedIds={selectedIds}
          detailCache={detailCache}
          loadingDetailIds={loadingDetailIds}
          isAdmin={isAdmin}
          onToggleExpand={toggleExpand}
          onToggleSelect={toggleSelect}
          onToggleActive={toggleActive}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}

// ---------------- View toggle ----------------

function ViewToggle({ viewMode, onChange }) {
  const modes = [
    { key: 'list', icon: List, label: 'List' },
    { key: 'grid', icon: LayoutGrid, label: 'Grid' },
    { key: 'compact', icon: Rows3, label: 'Compact' },
  ];
  return (
    <div style={styles.viewToggle}>
      {modes.map((m) => {
        const Icon = m.icon;
        const isActive = viewMode === m.key;
        return (
          <button
            key={m.key}
            title={m.label}
            onClick={() => onChange(m.key)}
            style={{ ...styles.viewToggleBtn, ...(isActive ? styles.viewToggleBtnActive : {}) }}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Chip ----------------

const CHIP_TONE_COLORS = {
  default: { color: theme.colors.textSecondary, bg: theme.colors.appBackground },
  warning: { color: theme.colors.warning, bg: theme.colors.warningBackground },
  muted: { color: theme.colors.textSecondary, bg: theme.colors.appBackground },
  danger: { color: theme.colors.danger, bg: theme.colors.dangerBackground },
};

function Chip({ label, active, onClick, tone = 'default' }) {
  const toneColors = CHIP_TONE_COLORS[tone] || CHIP_TONE_COLORS.default;
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.chip,
        ...(active
          ? { backgroundColor: toneColors.bg, color: toneColors.color, borderColor: toneColors.color }
          : { backgroundColor: theme.colors.cardBackground, color: theme.colors.textSecondary, borderColor: theme.colors.border }),
      }}
    >
      {label}
    </button>
  );
}

// ---------------- Status badges ----------------

function StatusBadges({ row }) {
  const badges = [];
  if (row.isOutOfStock) badges.push({ label: 'Out of Stock', color: theme.colors.danger, bg: theme.colors.dangerBackground });
  else if (row.isLow) badges.push({ label: 'Low Stock', color: theme.colors.warning, bg: theme.colors.warningBackground });
  if (row.isDead) badges.push({ label: 'Dead Stock', color: theme.colors.textSecondary, bg: theme.colors.appBackground, icon: true });
  if (badges.length === 0) badges.push({ label: 'Normal', color: theme.colors.success, bg: theme.colors.successBackground });

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {badges.map((b) => (
        <span key={b.label} style={{ ...styles.badge, color: b.color, backgroundColor: b.bg }}>
          {b.icon && <Clock size={10} style={{ marginRight: '3px', verticalAlign: '-1px' }} />}
          {b.label}
        </span>
      ))}
    </div>
  );
}

function statusDotColor(row) {
  if (row.isOutOfStock) return theme.colors.danger;
  if (row.isLow || row.isDead) return theme.colors.warning;
  return theme.colors.success;
}

// ---------------- Detail panel (lazy-loaded, cached) ----------------

function ProductDetailPanel({ productId, detail, loading, isAdmin, onNavigate }) {
  if (loading || !detail) {
    return <div style={{ padding: '16px', color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>Loading details…</div>;
  }

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h5 style={styles.detailHeading}>Variants</h5>
          <table style={styles.detailTable}>
            <thead>
              <tr>
                <th style={styles.detailTh}>Variant</th>
                <th style={styles.detailTh}>Barcode</th>
                <th style={{ ...styles.detailTh, textAlign: 'right' }}>Stock</th>
                <th style={styles.detailTh}>Last Sold</th>
              </tr>
            </thead>
            <tbody>
              {detail.variants.map((v) => (
                <tr key={v.id}>
                  <td style={styles.detailTd}>{v.variant_name}</td>
                  <td style={styles.detailTd}>{v.barcode || '—'}</td>
                  <td style={{ ...styles.detailTd, textAlign: 'right' }}>{formatCount(v.stock_qty)}</td>
                  <td style={styles.detailTd}>{v.last_sold_at ? formatDateTime(v.last_sold_at) : 'Never sold'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ flex: 1, minWidth: '280px' }}>
          <h5 style={styles.detailHeading}>Units</h5>
          <table style={styles.detailTable}>
            <thead>
              <tr>
                <th style={styles.detailTh}>Unit</th>
                <th style={{ ...styles.detailTh, textAlign: 'right' }}>Conv.</th>
                <th style={{ ...styles.detailTh, textAlign: 'right' }}>Retail</th>
                <th style={{ ...styles.detailTh, textAlign: 'right' }}>Wholesale</th>
                {isAdmin && <th style={{ ...styles.detailTh, textAlign: 'right' }}>Cost</th>}
              </tr>
            </thead>
            <tbody>
              {detail.units.map((u) => (
                <tr key={u.id}>
                  <td style={styles.detailTd}>{u.unit_name}</td>
                  <td style={{ ...styles.detailTd, textAlign: 'right' }}>{u.conversion_factor}</td>
                  <td style={{ ...styles.detailTd, textAlign: 'right' }}>{formatCurrency(u.retail_price)}</td>
                  <td style={{ ...styles.detailTd, textAlign: 'right' }}>{formatCurrency(u.wholesale_price)}</td>
                  {isAdmin && <td style={{ ...styles.detailTd, textAlign: 'right' }}>{formatCurrency(u.cost_price)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
        <Button variant="secondary" style={styles.actionBtn} onClick={() => onNavigate('/products/edit', { id: productId })}>
          Edit Product
        </Button>
        <Button variant="ghost" style={styles.actionBtn} onClick={() => onNavigate('/products/stock-adjustments', { productId })}>
          Adjust Stock
        </Button>
        <Button variant="ghost" style={styles.actionBtn} onClick={() => onNavigate('/products/stock-movements', { productId })}>
          View Movement History
        </Button>
      </div>
    </div>
  );
}

function ExpandWrapper({ expanded, children }) {
  return (
    <div
      style={{
        maxHeight: expanded ? '2000px' : '0px',
        opacity: expanded ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease, opacity 0.2s ease',
        borderBottom: expanded ? `1px solid ${theme.colors.border}` : 'none',
      }}
    >
      {children}
    </div>
  );
}

// ---------------- List / Compact table view ----------------

function TableView({ compact, rows, expandedIds, selectedIds, detailCache, loadingDetailIds, isAdmin, onToggleExpand, onToggleSelect, onToggleActive, onNavigate }) {
  const columnCount = compact ? 3 : 6;

  return (
    <Card style={{ padding: 0 }}>
      <div style={tableStyles.scroll}>
        <table style={tableStyles.table}>
          <thead>
            <tr>
              <th style={tableStyles.th}></th>
              <th style={tableStyles.th}>Name</th>
              {!compact && <th style={tableStyles.th}>Category</th>}
              <th style={{ ...tableStyles.th, textAlign: 'right' }}>Total Stock</th>
              {!compact && <th style={tableStyles.th}>Status</th>}
              {!compact && <th style={tableStyles.th}>Active</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const expanded = expandedIds.has(p.id);
              return (
                <React.Fragment key={p.id}>
                  <Tr onClick={() => onToggleExpand(p.id)} style={compact ? { fontSize: theme.font.sizeSm } : undefined}>
                    <td style={{ ...tableStyles.td, width: '32px' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(p.id)} onChange={(e) => onToggleSelect(p.id, e)} />
                    </td>
                    <td style={{ ...tableStyles.td, fontWeight: theme.font.weightMedium }}>
                      {p.name}
                      {compact && (
                        <span style={{ marginLeft: '8px', display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: statusDotColor(p), verticalAlign: 'middle' }} title={statusLabel(p)} />
                      )}
                    </td>
                    {!compact && <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{p.category_name || '—'}</td>}
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>
                      {formatCount(p.total_stock)} {p.base_unit_name}
                    </td>
                    {!compact && (
                      <td style={tableStyles.td}>
                        <StatusBadges row={p} />
                      </td>
                    )}
                    {!compact && (
                      <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={!!p.is_active} onChange={() => onToggleActive(p)} />
                      </td>
                    )}
                  </Tr>
                  <tr>
                    <td colSpan={columnCount} style={{ padding: 0, borderBottom: 'none' }}>
                      <ExpandWrapper expanded={expanded}>
                        {expanded && (
                          <ProductDetailPanel
                            productId={p.id}
                            detail={detailCache[p.id]}
                            loading={loadingDetailIds.has(p.id)}
                            isAdmin={isAdmin}
                            onNavigate={onNavigate}
                          />
                        )}
                      </ExpandWrapper>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------------- Grid (cards) view ----------------

function GridView({ rows, expandedIds, detailCache, loadingDetailIds, isAdmin, onToggleExpand, onNavigate }) {
  return (
    <div style={styles.grid}>
      {rows.map((p) => {
        const expanded = expandedIds.has(p.id);
        return (
          <div
            key={p.id}
            style={{ ...styles.gridCard, ...(expanded ? styles.gridCardActive : {}) }}
            onMouseEnter={(e) => {
              if (!expanded) e.currentTarget.style.borderColor = theme.colors.borderStrong;
            }}
            onMouseLeave={(e) => {
              if (!expanded) e.currentTarget.style.borderColor = theme.colors.border;
            }}
          >
            <div style={{ cursor: 'pointer' }} onClick={() => onToggleExpand(p.id)}>
              <div style={styles.gridCardName}>{p.name}</div>
              <div style={styles.gridCardCategory}>{p.category_name || 'Uncategorized'}</div>
              <div style={styles.gridCardStockRow}>
                <span style={{ fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary }}>
                  {formatCount(p.total_stock)} {p.base_unit_name}
                </span>
                <StatusBadges row={p} />
              </div>
              <div style={styles.gridCardMeta}>
                {p.variant_count} variant{p.variant_count === 1 ? '' : 's'} · {p.unit_count} unit{p.unit_count === 1 ? '' : 's'}
              </div>
            </div>

            <ExpandWrapper expanded={expanded}>
              {expanded && (
                <ProductDetailPanel
                  productId={p.id}
                  detail={detailCache[p.id]}
                  loading={loadingDetailIds.has(p.id)}
                  isAdmin={isAdmin}
                  onNavigate={onNavigate}
                />
              )}
            </ExpandWrapper>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: theme.spacing.sm },
  checkboxRow: { display: 'flex', gap: theme.spacing.lg, marginTop: theme.spacing.sm },
  chipRow: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: theme.spacing.md },
  chip: {
    padding: '6px 12px',
    borderRadius: theme.radius.md,
    border: '1px solid',
    fontSize: theme.font.sizeXs,
    cursor: 'pointer',
    fontFamily: theme.font.family,
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  countLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  metaControls: { display: 'flex', alignItems: 'center', gap: '8px' },
  sortDirBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  },
  viewToggle: { display: 'flex', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.sm, overflow: 'hidden' },
  viewToggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    border: 'none',
    borderRight: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
  },
  viewToggleBtnActive: { backgroundColor: theme.colors.primary, color: theme.colors.primaryText },
  searchInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.cardBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeBase,
    boxSizing: 'border-box',
    fontFamily: theme.font.family,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    fontSize: theme.font.sizeXs,
  },
  detailHeading: { margin: '0 0 8px', color: theme.colors.textPrimary, fontSize: theme.font.sizeSm, fontWeight: theme.font.weightSemibold },
  detailTable: { width: '100%', borderCollapse: 'collapse', fontSize: theme.font.sizeXs },
  detailTh: { textAlign: 'left', color: theme.colors.textSecondary, padding: '6px 8px', borderBottom: `1px solid ${theme.colors.border}` },
  detailTd: { padding: '6px 8px', color: theme.colors.textPrimary, borderBottom: `1px solid ${theme.colors.border}` },
  actionBtn: { padding: '7px 14px', fontSize: theme.font.sizeXs },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: theme.spacing.md },
  gridCard: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    transition: 'border-color 0.15s ease',
  },
  gridCardActive: { borderColor: theme.colors.borderStrong },
  gridCardName: { fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary, fontSize: theme.font.sizeBase },
  gridCardCategory: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '2px' },
  gridCardStockRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.sm, flexWrap: 'wrap', gap: '6px' },
  gridCardMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '8px' },
};
