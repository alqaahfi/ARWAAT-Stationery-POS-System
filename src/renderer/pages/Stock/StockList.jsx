import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PackageMinus, PackagePlus, SearchX } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import { Button, Card, EmptyState, SearchField, Select } from '../../components/ui';
import { StatusChips } from '../Products/list/ProductToolbar';
import { ProductTable, SkeletonRows } from '../Products/list/ProductRows';
import StockEntryDialog from './StockEntryDialog';

const NO_SELECTION = new Set();

// Stock (/stock): the Products list's table and status chips, trimmed to stock
// questions — how much is on the shelf and what needs attention. Add Stock and
// Delete Stock open the full multi-product forms; a row opens the Product Profile.
export default function StockList({ onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [chip, setChip] = useState('all');
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState({ rows: [], counts: { all: 0, lowStock: 0, deadStock: 0, outOfStock: 0 } });
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const seq = useRef(0);
  const navigateRef = useRef(onNavigate);
  navigateRef.current = onNavigate;

  useEffect(() => {
    window.api.categories.list().then(setCategories);
  }, []);

  function load() {
    const mine = ++seq.current;
    setLoading(true);
    window.api.products
      .list({
        search: search.trim() || null,
        categoryId: categoryId ? Number(categoryId) : null,
        lowStockOnly: chip === 'low',
        deadStockOnly: chip === 'dead',
        outOfStockOnly: chip === 'outOfStock',
        activeFilter: 'active',
        sortBy: 'name',
        sortDirection: 'asc',
      })
      .then((res) => {
        if (mine !== seq.current) return;
        setData(res);
        setLoading(false);
      });
  }

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, chip]);

  const actions = useMemo(() => ({ open: (id) => navigateRef.current('/products/profile', { id }) }), []);
  const filtersActive = !!search.trim() || !!categoryId || chip !== 'all';

  let content;
  if (loading && data.rows.length === 0) content = <SkeletonRows />;
  else if (data.rows.length === 0) {
    content = (
      <Card>
        <EmptyState
          icon={filtersActive ? SearchX : appIcons.products.icon}
          title={filtersActive ? 'No products match' : 'No products yet'}
          message={filtersActive ? 'Try a different search or filter.' : 'Add products first, then record their stock here.'}
          action={
            filtersActive ? (
              <Button
                variant="tinted"
                onClick={() => {
                  setSearch('');
                  setCategoryId('');
                  setChip('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => onNavigate('/products/new')}>Add a product</Button>
            )
          }
        />
      </Card>
    );
  } else content = <ProductTable rows={data.rows} isAdmin={false} actions={actions} compact={false} selectedIds={NO_SELECTION} />;

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search by name, item code or barcode" aria-label="Search products" style={{ flex: '1 1 220px', maxWidth: '420px' }} />
        <Select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={{ width: '180px' }}>
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.parent_name ? `${cat.parent_name} › ${cat.name}` : cat.name}
            </option>
          ))}
        </Select>
        {isAdmin && (
          <div style={{ display: 'flex', gap: theme.spacing.sm, marginLeft: 'auto' }}>
            <Button variant="tinted" icon={PackageMinus} onClick={() => setDialog('remove')}>
              Delete Stock
            </Button>
            <Button icon={PackagePlus} onClick={() => setDialog('add')}>
              Add Stock
            </Button>
          </div>
        )}
      </div>
      <StatusChips active={chip} counts={data.counts} onChange={setChip} shownCount={data.rows.length} loading={loading} />
      <div style={{ marginTop: theme.spacing.md, opacity: loading && data.rows.length > 0 ? 0.6 : 1, transition: `opacity ${theme.motion.fast} ease` }}>{content}</div>

      {dialog && <StockEntryDialog open mode={dialog} onSaved={() => loadRef.current()} onClose={() => setDialog(null)} />}
    </div>
  );
}
