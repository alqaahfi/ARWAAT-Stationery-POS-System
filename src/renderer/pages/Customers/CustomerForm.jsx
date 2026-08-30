import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Select, Button, Banner, HelperText } from '../../components/ui';

export default function CustomerForm({ customerId, onDone, onCancel }) {
  const { user } = useAuth();
  const isEdit = !!customerId;

  const [categories, setCategories] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState('retail');
  const [categoryId, setCategoryId] = useState('');
  const [assignedLetterheadId, setAssignedLetterheadId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    window.api.customerCategories.list().then(setCategories);
    window.api.letterheads.list().then(setLetterheads);
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    window.api.customers.getById({ id: customerId }).then((c) => {
      if (!c) return;
      setName(c.name);
      setCustomerType(c.customer_type);
      setCategoryId(c.category_id || '');
      setAssignedLetterheadId(c.assigned_letterhead_id || '');
      setPhone(c.phone || '');
      setAddress(c.address || '');
      setOpeningBalance(c.opening_balance);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function handleSave() {
    setError('');
    if (!name.trim()) return setError('Customer name is required.');

    setSaving(true);
    const payload = {
      name: name.trim(),
      customerType,
      categoryId: categoryId ? Number(categoryId) : null,
      assignedLetterheadId: assignedLetterheadId ? Number(assignedLetterheadId) : null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    };

    const res = isEdit
      ? await window.api.customers.update({ id: customerId, ...payload })
      : await window.api.customers.create({ ...payload, openingBalance: Number(openingBalance) || 0 });

    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not save customer.');
      return;
    }
    onDone();
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!loaded) {
    return <Card>Loading…</Card>;
  }

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Customer' : 'Add Customer'} />
      <Card style={{ maxWidth: '560px' }}>
        <Label>Name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <Label>Customer Type</Label>
        <div style={{ display: 'flex', gap: theme.spacing.lg, marginTop: '4px' }}>
          <label style={styles.radioLabel}>
            <input type="radio" checked={customerType === 'retail'} onChange={() => setCustomerType('retail')} />
            Retail
          </label>
          <label style={styles.radioLabel}>
            <input type="radio" checked={customerType === 'wholesale'} onChange={() => setCustomerType('wholesale')} />
            Wholesale
          </label>
        </div>

        <Label>Category (optional)</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        {customerType === 'wholesale' && (
          <>
            <Label>Assigned Letterhead (optional)</Label>
            <Select value={assignedLetterheadId} onChange={(e) => setAssignedLetterheadId(e.target.value)}>
              <option value="">Use shop default</option>
              {letterheads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </>
        )}

        <Label>Phone</Label>
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />

        <Label>Address</Label>
        <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />

        <Label>Opening Balance</Label>
        {isEdit ? (
          <>
            <TextInput value={openingBalance} disabled style={{ backgroundColor: theme.colors.appBackground, color: theme.colors.textSecondary }} />
            <HelperText>
              To adjust an existing customer's balance, record a payment or manual adjustment from their ledger instead of
              editing this number directly.
            </HelperText>
          </>
        ) : (
          <TextInput type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
        )}

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Customer'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  radioLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: theme.colors.textPrimary, fontSize: theme.font.sizeBase, cursor: 'pointer' },
};
