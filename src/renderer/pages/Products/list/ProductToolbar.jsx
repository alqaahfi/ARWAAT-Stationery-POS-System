import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileSpreadsheet, LayoutGrid, List, MoreHorizontal, Plus, Rows3 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, IconButton, Menu, MenuItem, Popover, SearchField, SegmentedControl, Select } from '../../../components/ui';

const c = theme.colors;

export const SORT_OPTIONS = [
  { key: 'name', label: 'Name (A–Z)' },
  { key: 'total_stock', label: 'Stock' },
  { key: 'category', label: 'Category' },
  { key: 'created_at', label: 'Recently added' },
  { key: 'updated_at', label: 'Recently updated' },
];

const VIEW_OPTIONS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'grid', label: 'Cards', icon: LayoutGrid },
  { value: 'compact', label: 'Compact', icon: Rows3 },
];

export function ProductToolbar({
  search,
  onSearch,
  categories,
  categoryId,
  onCategory,
  activeFilter,
  onActiveFilter,
  sortBy,
  sortDirection,
  onSortBy,
  onToggleDirection,
  viewMode,
  onViewMode,
  isAdmin,
  onAdd,
  onImport,
  onExport,
  exporting,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const asc = sortDirection === 'asc';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder="Search by name, item code or barcode"
        aria-label="Search products"
        style={{ flex: '1 1 220px', maxWidth: '420px' }}
      />
      <Select aria-label="Category" value={categoryId} onChange={(e) => onCategory(e.target.value)} style={{ width: '180px' }}>
        <option value="">All categories</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.parent_name ? `${cat.parent_name} › ${cat.name}` : cat.name}
          </option>
        ))}
      </Select>
      <Select aria-label="Show" value={activeFilter} onChange={(e) => onActiveFilter(e.target.value)} style={{ width: '130px' }}>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All</option>
      </Select>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <Select aria-label="Sort by" value={sortBy} onChange={(e) => onSortBy(e.target.value)} style={{ width: '170px' }}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              Sort: {o.label}
            </option>
          ))}
        </Select>
        <IconButton icon={asc ? ArrowUp : ArrowDown} label={asc ? 'Sorted low to high — click to reverse' : 'Sorted high to low — click to reverse'} onClick={onToggleDirection} />
      </div>
      <SegmentedControl label="View" options={VIEW_OPTIONS} value={viewMode} onChange={onViewMode} />

      {isAdmin && (
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs, marginLeft: 'auto' }}>
          <Button icon={Plus} onClick={onAdd}>
            {glossary.addProduct}
          </Button>
          <Popover
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            width={240}
            anchor={
              <IconButton
                icon={MoreHorizontal}
                label="More"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
                style={{ backgroundColor: menuOpen ? c.fill : undefined }}
              />
            }
          >
            {(close) => (
              <Menu label="More">
                <MenuItem
                  icon={FileSpreadsheet}
                  label={glossary.importSpreadsheet}
                  onClick={() => {
                    close();
                    onImport();
                  }}
                />
                <MenuItem
                  icon={Download}
                  label={exporting ? 'Exporting…' : glossary.exportCsv}
                  disabled={exporting}
                  onClick={() => {
                    close();
                    onExport();
                  }}
                />
              </Menu>
            )}
          </Popover>
        </div>
      )}
    </div>
  );
}

const CHIPS = [
  { key: 'all', label: 'All', countKey: null },
  { key: 'low', label: glossary.runningLow, countKey: 'lowStock' },
  { key: 'dead', label: glossary.notSelling, countKey: 'deadStock' },
  { key: 'outOfStock', label: glossary.outOfStock, countKey: 'outOfStock' },
];

// Pill-style filter group plus the "{n} products" footnote.
export function StatusChips({ active, counts, onChange, shownCount, loading }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.smd }}>
      <div role="radiogroup" aria-label="Filter by stock status" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {CHIPS.map((chip) => {
          const selected = active === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(chip.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: theme.control.sm,
                padding: '0 12px',
                border: 'none',
                borderRadius: theme.radius.pill,
                backgroundColor: selected ? c.accent : c.fill,
                color: selected ? c.labelOnAccent : c.label,
                fontFamily: theme.font.family,
                ...theme.type.subhead,
                fontWeight: theme.font.weightMedium,
                cursor: 'pointer',
                transition: `background-color ${theme.motion.fast} ease`,
              }}
            >
              {chip.label}
              {chip.countKey && <span style={{ ...theme.font.numeric, opacity: 0.75 }}>{counts[chip.countKey]}</span>}
            </button>
          );
        })}
      </div>
      <span style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, marginLeft: 'auto' }}>
        {loading ? 'Loading…' : `${shownCount} product${shownCount === 1 ? '' : 's'}`}
      </span>
    </div>
  );
}
