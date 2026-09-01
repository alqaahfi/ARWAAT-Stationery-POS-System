import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, tableStyles, Tr, Label, TextInput, Select, TextArea, Banner, HelperText } from '../../components/ui';
import { formatCurrencyExact, formatDateTime } from '../../utils/format';

// Route: /ledgers/adjustments. Manual corrections to a customer/supplier
// balance — e.g. writing off a bad debt, forgiving part of a balance,
// correcting an under-recorded charge. Never allow a blank reason: this is a
// financial audit trail.
export default function Adjustments() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);

  async function load() {
    setLoading(true);
    const data = await window.api.ledgers.listAdjustments();
    setRows(data);
    setLoading(false);
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
      <PageHeader title="Manual Adjustments" actions={<Button onClick={() => setShowForm(true)}>+ Add Adjustment</Button>} />

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Party</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Amount</th>
                <th style={tableStyles.th}>Reason</th>
                <th style={tableStyles.th}>Created By</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <td style={tableStyles.td}>{formatDateTime(r.created_at)}</td>
                  <td style={tableStyles.td}>
                    {r.party_name || '—'} <span style={{ color: theme.colors.textSecondary, textTransform: 'capitalize' }}>({r.party_type})</span>
                  </td>
                  <td
                    style={{
                      ...tableStyles.td,
                      textAlign: 'right',
                      fontWeight: theme.font.weightMedium,
                      color: r.amount > 0 ? theme.colors.danger : theme.colors.success,
                    }}
                  >
                    {r.amount > 0 ? '+' : ''}
                    {formatCurrencyExact(r.amount)}
                  </td>
                  <td style={tableStyles.td}>{r.reason}</td>
                  <td style={tableStyles.td}>{r.created_by_name || '—'}</td>
                </Tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} style={tableStyles.emptyState}>
                    No manual adjustments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <AdjustmentModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AdjustmentModal({ onClose, onSaved }) {
  const { user } = useAuth();
  const [partyType, setPartyType] = useState('customer');
  const [partySearch, setPartySearch] = useState('');
  const [partyResults, setPartyResults] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef(null);

  function switchPartyType(type) {
    setPartyType(type);
    setSelectedParty(null);
    setPartySearch('');
    setPartyResults([]);
  }

  function handlePartySearch(value) {
    setPartySearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setPartyResults([]);
        return;
      }
      const rows =
        partyType === 'customer'
          ? await window.api.customers.searchMinimal({ search: value.trim() })
          : await window.api.suppliers.searchMinimal({ search: value.trim() });
      setPartyResults(rows);
    }, 250);
  }

  function selectParty(row) {
    setSelectedParty(row);
    setPartySearch('');
    setPartyResults([]);
  }

  async function handleSave() {
    setError('');
    if (!selectedParty) return setError('Select a party.');
    const amt = Number(amount);
    if (!amt || Number.isNaN(amt)) return setError('Enter a non-zero amount.');
    if (!reason.trim()) return setError('A reason is required.');

    setSaving(true);
    const res = await window.api.ledgers.createAdjustment({
      partyType,
      partyId: selectedParty.id,
      amount: amt,
      reason: reason.trim(),
      createdBy: user.id,
      requestingUserId: user.id,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save adjustment.');
      return;
    }
    onSaved();
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h3 style={modalStyles.title}>Add Manual Adjustment</h3>

        <Label>Party Type</Label>
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: '4px' }}>
          <Button variant={partyType === 'customer' ? 'primary' : 'secondary'} onClick={() => switchPartyType('customer')} style={{ flex: 1 }}>
            Customer
          </Button>
          <Button variant={partyType === 'supplier' ? 'primary' : 'secondary'} onClick={() => switchPartyType('supplier')} style={{ flex: 1 }}>
            Supplier
          </Button>
        </div>

        <Label>{partyType === 'customer' ? 'Customer' : 'Supplier'}</Label>
        {selectedParty ? (
          <div style={styles.selectedParty}>
            <span>{selectedParty.name}</span>
            <Button variant="ghost" style={{ padding: '4px 10px', fontSize: theme.font.sizeXs }} onClick={() => setSelectedParty(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <TextInput placeholder="Search name or phone…" value={partySearch} onChange={(e) => handlePartySearch(e.target.value)} />
            {partyResults.length > 0 && (
              <div style={styles.pickerResults}>
                {partyResults.map((r) => (
                  <div
                    key={r.id}
                    style={styles.pickerRow}
                    onClick={() => selectParty(r)}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {r.name}
                    {r.phone ? ` · ${r.phone}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Label>Amount</Label>
        <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 500 or -500" />
        <HelperText>Enter a positive number to increase what they owe, negative to decrease/write off.</HelperText>

        <Label>Reason (required)</Label>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrote off bad debt per admin decision" />

        <Banner>{error}</Banner>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Adjustment'}
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
  selectedParty: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 10px',
    borderRadius: theme.radius.sm,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.appBackground,
    color: theme.colors.textPrimary,
    fontSize: theme.font.sizeBase,
  },
  pickerResults: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginTop: '4px',
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    maxHeight: '180px',
    overflowY: 'auto',
    zIndex: 20,
  },
  pickerRow: {
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
    color: theme.colors.textPrimary,
    transition: 'background-color 0.15s ease',
  },
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
    width: '420px',
    maxHeight: '90vh',
    overflowY: 'auto',
    fontFamily: theme.font.family,
  },
  title: { color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, margin: 0, fontWeight: theme.font.weightSemibold },
};
