import React, { useEffect, useState } from 'react';
import theme from '../../../config/theme';
import { Button, TextInput, Select, Label, Banner } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';

// Selecting a customer also resolves which letterhead a wholesale invoice
// should print with (their own assignment, else the shop's default) and hands
// both back in one call so Sale.jsx doesn't need its own letterhead lookup.
export default function CustomerSelector({ customer, onSelectCustomer }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [customers, setCustomers] = useState([]);
  const [letterheads, setLetterheads] = useState([]);
  const [search, setSearch] = useState('');
  const [showList, setShowList] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    window.api.customers.list().then(setCustomers);
    window.api.letterheads.list().then(setLetterheads);
  }

  function resolveLetterhead(c) {
    if (!c) return null;
    if (c.assigned_letterhead_id) return c.assigned_letterhead_id;
    const def = letterheads.find((l) => l.is_default);
    return def ? def.id : null;
  }

  function selectCustomer(c) {
    onSelectCustomer(c, resolveLetterhead(c));
    setShowList(false);
    setSearch('');
  }

  function selectWalkIn() {
    onSelectCustomer(null, null);
    setShowList(false);
    setSearch('');
  }

  const filtered = customers.filter(
    (c) => !search.trim() || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search)
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>Customer</div>

      <div style={styles.selectedCard}>
        <div>
          <div style={styles.selectedName}>{customer ? customer.name : 'Walk-in Customer'}</div>
          {customer && (
            <div style={styles.selectedMeta}>
              {customer.customer_type}
              {customer.phone ? ` · ${customer.phone}` : ''}
            </div>
          )}
        </div>
        <Button variant="ghost" style={styles.changeBtn} onClick={() => setShowList(true)}>
          {customer ? 'Change' : 'Select'}
        </Button>
      </div>

      {showList && (
        <div style={styles.dropdown}>
          <TextInput autoFocus placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={styles.resultsList}>
            <div
              style={styles.resultRow}
              onClick={selectWalkIn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Walk-in / No customer
            </div>
            {filtered.map((c) => (
              <div
                key={c.id}
                style={styles.resultRow}
                onClick={() => selectCustomer(c)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div>{c.name}</div>
                <div style={styles.resultMeta}>
                  {c.customer_type}
                  {c.phone ? ` · ${c.phone}` : ''}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={styles.resultMeta}>No matches.</div>}
          </div>
          {isAdmin && (
            <Button variant="secondary" style={{ marginTop: '8px', width: '100%' }} onClick={() => setShowAddModal(true)}>
              + Add Customer
            </Button>
          )}
          <Button variant="ghost" style={{ marginTop: '6px', width: '100%' }} onClick={() => setShowList(false)}>
            Cancel
          </Button>
        </div>
      )}

      {showAddModal && (
        <AddCustomerModal
          letterheads={letterheads}
          onClose={() => setShowAddModal(false)}
          onCreated={(newCustomer) => {
            setShowAddModal(false);
            load();
            selectCustomer(newCustomer);
          }}
        />
      )}
    </div>
  );
}

function AddCustomerModal({ letterheads, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [customerType, setCustomerType] = useState('retail');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [assignedLetterheadId, setAssignedLetterheadId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    const res = await window.api.customers.create({
      name: name.trim(),
      customerType,
      assignedLetterheadId: assignedLetterheadId ? Number(assignedLetterheadId) : null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.reason || 'Could not create customer.');
      return;
    }
    onCreated({
      id: res.id,
      name: name.trim(),
      customer_type: customerType,
      phone: phone.trim(),
      category_id: null,
      assigned_letterhead_id: assignedLetterheadId ? Number(assignedLetterheadId) : null,
    });
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h3 style={modalStyles.title}>Add Customer</h3>

        <Label>Name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />

        <Label>Type</Label>
        <Select value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
        </Select>

        <Label>Phone (optional)</Label>
        <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} />

        <Label>Address (optional)</Label>
        <TextInput value={address} onChange={(e) => setAddress(e.target.value)} />

        {customerType === 'wholesale' && (
          <>
            <Label>Letterhead (optional)</Label>
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

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: '10px', marginTop: '18px' }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Customer'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.card,
    padding: theme.spacing.md,
    fontFamily: theme.font.family,
    position: 'relative',
  },
  header: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' },
  selectedCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  selectedName: { color: theme.colors.textPrimary, fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold },
  selectedMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'capitalize', marginTop: '2px' },
  changeBtn: { padding: '6px 12px', fontSize: theme.font.sizeXs },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '6px',
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    padding: '12px',
    zIndex: 20,
  },
  resultsList: { maxHeight: '220px', overflowY: 'auto', marginTop: '8px' },
  resultRow: {
    padding: '8px 10px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeSm,
    transition: 'background-color 0.15s ease',
  },
  resultMeta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, marginTop: '2px', textTransform: 'capitalize' },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  card: {
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    padding: '24px',
    width: '380px',
    fontFamily: theme.font.family,
  },
  title: { color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, margin: 0, fontWeight: theme.font.weightSemibold },
};
