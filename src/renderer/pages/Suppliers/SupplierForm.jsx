import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, TextArea, Button, Banner, HelperText } from '../../components/ui';

export default function SupplierForm({ supplierId, onDone, onCancel }) {
  const { user } = useAuth();
  const isEdit = !!supplierId;

  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [openingBalance, setOpeningBalance] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit) return;
    window.api.suppliers.getById({ id: supplierId }).then((s) => {
      if (!s) return;
      setName(s.name);
      setContactPerson(s.contact_person || '');
      setPhone(s.phone || '');
      setAddress(s.address || '');
      setNotes(s.notes || '');
      setOpeningBalance(s.opening_balance);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  async function handleSave() {
    setError('');
    if (!name.trim()) return setError('Supplier name is required.');

    setSaving(true);
    const payload = {
      name: name.trim(),
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    };

    const res = isEdit
      ? await window.api.suppliers.update({ id: supplierId, ...payload })
      : await window.api.suppliers.create({ ...payload, openingBalance: Number(openingBalance) || 0 });

    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not save supplier.');
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

  if (!loaded) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title={isEdit ? 'Edit Supplier' : 'Add Supplier'} />
      <Card style={{ maxWidth: '560px' }}>
        <Label>Name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <Label>Contact Person</Label>
        <TextInput value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />

        <Label>Phone</Label>
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />

        <Label>Address</Label>
        <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />

        <Label>Notes</Label>
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />

        <Label>Opening Balance</Label>
        {isEdit ? (
          <>
            <TextInput value={openingBalance} disabled style={{ backgroundColor: theme.colors.appBackground, color: theme.colors.textSecondary }} />
            <HelperText>
              To adjust balance, record a payment or add a purchase from this supplier's ledger instead of editing this number
              directly.
            </HelperText>
          </>
        ) : (
          <TextInput type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
        )}

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Supplier'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
