import React, { useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Select, TextArea, Button, Banner } from '../../components/ui';
import { formatCurrency } from '../../utils/format';

// Deliberately minimal — this is NOT the full ledger. Only enough context to
// take a payment: name, type, current balance. No transaction history here.
export default function RecordPayment() {
  const { user, hasPermission } = useAuth();
  const canRecord = hasPermission('record_payment');

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const debounceRef = useRef(null);

  function handleQueryChange(value) {
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  }

  async function runSearch(value) {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const rows = await window.api.customers.searchMinimal({ search: value.trim() });
    setResults(rows);
  }

  function selectCustomer(c) {
    setSelected(c);
    setResults([]);
    setQuery('');
    setError('');
    setConfirmation(null);
  }

  function resetForNext() {
    setSelected(null);
    setAmount('');
    setPaymentMethod('cash');
    setNote('');
    setError('');
  }

  async function handleSave() {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter an amount greater than zero.');

    if (selected.balance_owed > 0 && amt > selected.balance_owed + 0.01) {
      const proceed = window.confirm(
        `This payment (${formatCurrency(amt)}) is more than the current balance owed (${formatCurrency(selected.balance_owed)}). Record it as an overpayment?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    const res = await window.api.payments.createStandalone({
      customerId: selected.id,
      amount: amt,
      paymentMethod,
      note: note.trim() || null,
      receivedBy: user.id,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not record payment.');
      return;
    }

    setConfirmation({ name: selected.name, amount: amt, newBalance: res.newBalance });
    resetForNext();
  }

  if (!canRecord) {
    return (
      <Card style={{ padding: '40px' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>You don't have access to this page</h3>
        <p style={{ color: theme.colors.textSecondary }}>Ask your admin to grant you the "record payment" permission.</p>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Record Payment" />

      {confirmation && (
        <div style={styles.confirmationBanner}>
          Recorded {formatCurrency(confirmation.amount)} from {confirmation.name}. New balance:{' '}
          {formatCurrency(confirmation.newBalance)}
          <button style={styles.dismissBtn} onClick={() => setConfirmation(null)}>
            ✕
          </button>
        </div>
      )}

      <Card style={{ maxWidth: '480px' }}>
        {!selected && (
          <>
            <Label>Search Customer (name or phone)</Label>
            <TextInput autoFocus value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Start typing…" />
            <div style={styles.results}>
              {results.map((c) => (
                <div
                  key={c.id}
                  style={styles.resultRow}
                  onClick={() => selectCustomer(c)}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div>
                    <div style={{ color: theme.colors.textPrimary }}>{c.name}</div>
                    <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'capitalize' }}>
                      {c.customer_type}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </div>
                  </div>
                  <div style={{ color: c.balance_owed > 0 ? theme.colors.danger : theme.colors.success, fontWeight: theme.font.weightMedium }}>
                    {formatCurrency(c.balance_owed)}
                  </div>
                </div>
              ))}
              {query.trim() && results.length === 0 && (
                <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, padding: '8px' }}>No matches.</div>
              )}
            </div>
          </>
        )}

        {selected && (
          <>
            <div style={styles.selectedCard}>
              <div>
                <div style={styles.selectedName}>{selected.name}</div>
                <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'capitalize' }}>
                  {selected.customer_type}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeXs }}>Balance Owed</div>
                <div
                  style={{
                    fontSize: theme.font.sizeLg,
                    fontWeight: theme.font.weightSemibold,
                    color: selected.balance_owed > 0 ? theme.colors.danger : theme.colors.success,
                  }}
                >
                  {formatCurrency(selected.balance_owed)}
                </div>
              </div>
            </div>

            <Label>Amount</Label>
            <TextInput type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />

            <Label>Payment Method</Label>
            <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
              <option value="other">Other</option>
            </Select>

            <Label>Note (optional)</Label>
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} />

            <Banner>{error}</Banner>

            <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Record Payment'}
              </Button>
              <Button variant="ghost" onClick={resetForNext}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

const styles = {
  results: { marginTop: theme.spacing.sm, maxHeight: '260px', overflowY: 'auto' },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 8px',
    borderRadius: theme.radius.md,
    cursor: 'pointer',
    borderBottom: `1px solid ${theme.colors.border}`,
    transition: 'background-color 0.15s ease',
  },
  selectedCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  selectedName: { fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary },
  confirmationBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.successBackground,
    color: theme.colors.success,
    border: `1px solid ${theme.colors.success}`,
    padding: '10px 16px',
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.font.sizeSm,
  },
  dismissBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: theme.font.sizeBase, color: theme.colors.success },
};
