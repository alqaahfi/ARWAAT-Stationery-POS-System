import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, TextInput, Select, tableStyles, Tr } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

export default function CustomerList({ onNavigate }) {
  const { user } = useAuth();

  const [customers, setCustomers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    window.api.customerCategories.list().then(setCategories);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, typeFilter]);

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 250);
  }

  async function load() {
    setLoading(true);
    const rows = await window.api.customers.list({
      search,
      categoryId: categoryFilter || null,
      customerType: typeFilter || null,
    });
    setCustomers(rows);
    setLoading(false);
  }

  async function toggleActive(c) {
    await window.api.customers.setActive({ id: c.id, isActive: c.is_active ? 0 : 1 });
    load();
  }

  // Hard role gate — Customers is admin-only regardless of the permission
  // system. Sidebar already never renders this route for a cashier, but this
  // page defends itself too in case it's ever reached directly. All hooks
  // above run unconditionally every render; this check only decides the
  // returned JSX.
  if (user.role !== 'admin') {
    return <RestrictedNotice />;
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        actions={<Button onClick={() => onNavigate('/customers/new')}>+ Add Customer</Button>}
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <TextInput
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1 }}
          />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: '220px' }}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Types</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
          </Select>
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>Type</th>
                <th style={tableStyles.th}>Category</th>
                <th style={tableStyles.th}>Phone</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Balance Owed</th>
                <th style={tableStyles.th}>Active</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <Tr key={c.id} onClick={() => onNavigate('/customers/ledger-view', { id: c.id, name: c.name })}>
                  <td style={tableStyles.td}>{c.name}</td>
                  <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>
                    <span style={c.customer_type === 'wholesale' ? styles.badgeWholesale : styles.badgeRetail}>
                      {c.customer_type}
                    </span>
                  </td>
                  <td style={tableStyles.td}>{c.category_name || '—'}</td>
                  <td style={tableStyles.td}>{c.phone || '—'}</td>
                  <td
                    style={{
                      ...tableStyles.td,
                      textAlign: 'right',
                      color: c.balance_owed > 0 ? theme.colors.danger : theme.colors.success,
                      fontWeight: theme.font.weightMedium,
                    }}
                  >
                    {formatCurrency(c.balance_owed)}
                  </td>
                  <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!c.is_active} onChange={() => toggleActive(c)} />
                  </td>
                  <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => onNavigate('/customers/edit', { id: c.id })}>
                      Edit
                    </Button>
                  </td>
                </Tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={7} style={tableStyles.emptyState}>
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RestrictedNotice() {
  return (
    <Card style={{ padding: '48px', textAlign: 'center' }}>
      <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
    </Card>
  );
}

const styles = {
  filterRow: { display: 'flex', gap: theme.spacing.sm },
  badgeRetail: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    fontSize: theme.font.sizeXs,
  },
  badgeWholesale: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warningBackground,
    color: theme.colors.warning,
    fontSize: theme.font.sizeXs,
  },
};
