import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, Select, TextInput, Button, Banner, tableStyles, Tr } from '../../components/ui';

const TIERS = ['C1', 'C2', 'C3', 'C4', 'C5'];

export default function PercentageRules() {
  const { user } = useAuth();

  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [productId, setProductId] = useState('');
  const [targetType, setTargetType] = useState('customer');
  const [customerId, setCustomerId] = useState('');
  const [customerTier, setCustomerTier] = useState('');
  const [percentage, setPercentage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadRules();
    window.api.percentageRules.listEligibleProducts().then(setProducts);
    window.api.customers.list().then(setCustomers);
  }, []);

  async function loadRules() {
    const rows = await window.api.percentageRules.list();
    setRules(rows);
  }

  async function handleAdd() {
    setError('');
    const res = await window.api.percentageRules.create({
      productId: productId ? Number(productId) : null,
      targetType,
      customerId: targetType === 'customer' && customerId ? Number(customerId) : null,
      customerTier: targetType === 'tier' && customerTier ? customerTier : null,
      percentage: percentage === '' ? null : Number(percentage),
    });
    if (!res.success) {
      setError(res.reason || 'Could not create rule.');
      return;
    }
    setProductId('');
    setCustomerId('');
    setCustomerTier('');
    setPercentage('');
    loadRules();
  }

  async function handleDelete(id) {
    await window.api.percentageRules.delete({ id });
    loadRules();
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Percentage Pricing Rules" />

      <Card style={{ marginBottom: theme.spacing.lg, maxWidth: '560px' }}>
        <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>Add Rule</h4>

        <Label>Product</Label>
        <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>

        <Label>Target</Label>
        <div style={{ display: 'flex', gap: theme.spacing.lg, marginTop: '4px' }}>
          <label style={styles.radioLabel}>
            <input type="radio" checked={targetType === 'customer'} onChange={() => setTargetType('customer')} />
            Specific Customer
          </label>
          <label style={styles.radioLabel}>
            <input type="radio" checked={targetType === 'tier'} onChange={() => setTargetType('tier')} />
            Whole Tier
          </label>
        </div>

        {targetType === 'customer' ? (
          <>
            <Label>Customer</Label>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <>
            <Label>Tier</Label>
            <Select value={customerTier} onChange={(e) => setCustomerTier(e.target.value)}>
              <option value="">Select a tier…</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </>
        )}

        <Label>Percentage (margin over cost)</Label>
        <TextInput type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="e.g. 15" />

        <Banner>{error}</Banner>

        <Button onClick={handleAdd} style={{ marginTop: theme.spacing.md }}>
          Add Rule
        </Button>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Product</th>
                <th style={tableStyles.th}>Target</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Percentage</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <Tr key={r.id}>
                  <td style={tableStyles.td}>{r.product_name}</td>
                  <td style={tableStyles.td}>{r.customer_name || r.customer_tier || '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right' }}>{r.percentage}%</td>
                  <td style={tableStyles.td}>
                    <Button variant="danger" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => handleDelete(r.id)}>
                      Delete
                    </Button>
                  </td>
                </Tr>
              ))}
              {rules.length === 0 && (
                <tr>
                  <td colSpan={4} style={tableStyles.emptyState}>
                    No percentage pricing rules yet.
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

const styles = {
  radioLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, cursor: 'pointer' },
};
