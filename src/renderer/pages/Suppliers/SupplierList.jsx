import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, TextInput, tableStyles, Tr } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

export default function SupplierList({ onNavigate }) {
  const { user } = useAuth();

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, 250);
  }

  async function load() {
    setLoading(true);
    const rows = await window.api.suppliers.list({ search });
    setSuppliers(rows);
    setLoading(false);
  }

  async function toggleActive(s) {
    await window.api.suppliers.setActive({ id: s.id, isActive: s.is_active ? 0 : 1 });
    load();
  }

  // Hard role gate — Suppliers is admin-only regardless of the permission
  // system, same rule as Customers. All hooks above run unconditionally every
  // render; this check only decides the returned JSX.
  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Suppliers" actions={<Button onClick={() => onNavigate('/suppliers/new')}>+ Add Supplier</Button>} />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <TextInput placeholder="Search name or phone…" value={search} onChange={(e) => handleSearchChange(e.target.value)} />
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>Contact Person</th>
                <th style={tableStyles.th}>Phone</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Balance Owed</th>
                <th style={tableStyles.th}>Active</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <Tr key={s.id} onClick={() => onNavigate('/suppliers/ledger-view', { id: s.id, name: s.name })}>
                  <td style={tableStyles.td}>{s.name}</td>
                  <td style={tableStyles.td}>{s.contact_person || '—'}</td>
                  <td style={tableStyles.td}>{s.phone || '—'}</td>
                  <td
                    style={{
                      ...tableStyles.td,
                      textAlign: 'right',
                      color: s.balance_owed > 0 ? theme.colors.danger : theme.colors.success,
                      fontWeight: theme.font.weightMedium,
                    }}
                  >
                    {formatCurrency(s.balance_owed)}
                  </td>
                  <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!s.is_active} onChange={() => toggleActive(s)} />
                  </td>
                  <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => onNavigate('/suppliers/edit', { id: s.id })}>
                      Edit
                    </Button>
                  </td>
                </Tr>
              ))}
              {!loading && suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} style={tableStyles.emptyState}>
                    No suppliers found.
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
