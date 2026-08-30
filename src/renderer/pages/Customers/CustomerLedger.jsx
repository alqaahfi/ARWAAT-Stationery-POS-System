import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, tableStyles, Tr, Label, TextInput, Select, TextArea, Banner } from '../../components/ui';
import { formatCurrency, formatDateTime } from '../../utils/format';

// Mounted at both /customers/ledger (no customerId — picker mode, reached
// from the nav item) and /customers/ledger-view (customerId from a Customer
// List row click — preselected mode). Switching the picker's selection while
// already viewing a ledger just reloads for the newly picked customer, no
// navigating away.
export default function CustomerLedger({ customerId, onNavigate }) {
  const { user } = useAuth();

  const [selectedId, setSelectedId] = useState(customerId || null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const debounceRef = useRef(null);

  // A fresh row click passes a new customerId prop even while this component
  // stays mounted — keep the picker's notion of "selected" in sync with it.
  useEffect(() => {
    setSelectedId(customerId || null);
  }, [customerId]);

  useEffect(() => {
    if (!selectedId) {
      setData(null);
      return;
    }
    load(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function load(id) {
    setLoading(true);
    const res = await window.api.customers.getLedger({ id });
    setData(res.success ? res : null);
    setLoading(false);
  }

  function handlePickerSearch(value) {
    setPickerSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setPickerResults([]);
        return;
      }
      const rows = await window.api.customers.searchMinimal({ search: value.trim() });
      setPickerResults(rows);
    }, 250);
  }

  function selectFromPicker(row) {
    setSelectedId(row.id);
    setPickerSearch('');
    setPickerResults([]);
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
      <PageHeader
        title="Customer Ledger"
        actions={
          <Button variant="ghost" onClick={() => onNavigate('/customers')}>
            ← Back to Customers
          </Button>
        }
      />

      <Card style={{ marginBottom: theme.spacing.md, position: 'relative' }}>
        <Label>Search Customer</Label>
        <TextInput placeholder="Search name or phone…" value={pickerSearch} onChange={(e) => handlePickerSearch(e.target.value)} autoFocus={!selectedId} />
        {pickerResults.length > 0 && (
          <div style={styles.pickerResults}>
            {pickerResults.map((r) => (
              <div
                key={r.id}
                style={styles.pickerRow}
                onClick={() => selectFromPicker(r)}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div style={{ color: theme.colors.textPrimary }}>
                  {r.name}
                  {r.phone ? ` · ${r.phone}` : ''}
                </div>
                <div style={{ color: r.balance_owed > 0 ? theme.colors.danger : theme.colors.success, fontWeight: theme.font.weightMedium }}>
                  {formatCurrency(r.balance_owed)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {loading && <Card>Loading…</Card>}

      {!loading && !selectedId && (
        <Card style={{ color: theme.colors.textSecondary, textAlign: 'center', padding: '32px' }}>
          Search for a customer above, or click one from the Customer List, to view their ledger.
        </Card>
      )}

      {!loading && selectedId && !data && <Card>Customer not found.</Card>}

      {!loading && selectedId && data && (
        <>
          <Card style={{ marginBottom: theme.spacing.md }}>
            <div style={styles.headerRow}>
              <div>
                <div style={styles.name}>{data.customer.name}</div>
                <div style={styles.meta}>
                  <span style={{ textTransform: 'capitalize' }}>{data.customer.customer_type}</span>
                  {data.customer.category_name ? ` · ${data.customer.category_name}` : ''}
                  {data.customer.phone ? ` · ${data.customer.phone}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={styles.balanceLabel}>Current Balance</div>
                <div style={{ ...styles.balanceValue, color: data.balance > 0 ? theme.colors.danger : theme.colors.success }}>
                  {formatCurrency(data.balance)}
                </div>
              </div>
            </div>
            <div style={{ marginTop: theme.spacing.md }}>
              <Button onClick={() => setShowPaymentForm(true)}>Record Payment</Button>
            </div>
          </Card>

          <Card style={{ padding: 0 }}>
            <div style={tableStyles.scroll}>
              <table style={tableStyles.table}>
                <thead>
                  <tr>
                    <th style={tableStyles.th}>Date</th>
                    <th style={tableStyles.th}>Type</th>
                    <th style={tableStyles.th}>Reference</th>
                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Debit</th>
                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Credit</th>
                    <th style={{ ...tableStyles.th, textAlign: 'right' }}>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <Tr>
                    <td style={tableStyles.td}>{formatDateTime(data.customer.created_at)}</td>
                    <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>Opening Balance</td>
                    <td style={tableStyles.td}>—</td>
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>—</td>
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>—</td>
                    <td style={{ ...tableStyles.td, textAlign: 'right' }}>{formatCurrency(data.customer.opening_balance)}</td>
                  </Tr>
                  {data.transactions.map((t, i) => (
                    <Tr key={i}>
                      <td style={tableStyles.td}>{formatDateTime(t.date)}</td>
                      <td style={{ ...tableStyles.td, textTransform: 'capitalize' }}>{t.type}</td>
                      <td style={tableStyles.td}>
                        {t.reference || '—'}
                        {t.note ? ` (${t.note})` : ''}
                      </td>
                      <td style={{ ...tableStyles.td, textAlign: 'right' }}>{t.debit ? formatCurrency(t.debit) : '—'}</td>
                      <td style={{ ...tableStyles.td, textAlign: 'right' }}>{t.credit ? formatCurrency(t.credit) : '—'}</td>
                      <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: theme.font.weightMedium }}>
                        {formatCurrency(t.runningBalance)}
                      </td>
                    </Tr>
                  ))}
                  {data.transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} style={tableStyles.emptyState}>
                        No sales or payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {showPaymentForm && data && (
        <PaymentModal
          customer={data.customer}
          balance={data.balance}
          onClose={() => setShowPaymentForm(false)}
          onRecorded={() => {
            setShowPaymentForm(false);
            load(selectedId);
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({ customer, balance, onClose, onRecorded }) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Enter an amount greater than zero.');

    if (amt > balance + 0.01 && balance > 0) {
      const proceed = window.confirm(
        `This payment (${amt}) is more than the current balance owed (${balance}). Record it as an overpayment?`
      );
      if (!proceed) return;
    }

    setSaving(true);
    const res = await window.api.payments.createStandalone({
      customerId: customer.id,
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
    onRecorded();
  }

  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.card}>
        <h3 style={modalStyles.title}>Record Payment — {customer.name}</h3>

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
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary },
  meta: { color: theme.colors.textSecondary, fontSize: theme.font.sizeSm, marginTop: '4px' },
  balanceLabel: { color: theme.colors.textSecondary, fontSize: theme.font.sizeXs, textTransform: 'uppercase', letterSpacing: '0.03em' },
  balanceValue: { fontSize: theme.font.sizeXl, fontWeight: theme.font.weightSemibold, marginTop: '2px' },
  pickerResults: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    marginTop: '4px',
    backgroundColor: theme.colors.cardBackground,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    boxShadow: theme.shadow.dropdown,
    maxHeight: '220px',
    overflowY: 'auto',
    zIndex: 20,
  },
  pickerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: theme.font.sizeSm,
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
    width: '400px',
    fontFamily: theme.font.family,
  },
  title: { color: theme.colors.textPrimary, fontSize: theme.font.sizeLg, margin: 0, fontWeight: theme.font.weightSemibold },
};
