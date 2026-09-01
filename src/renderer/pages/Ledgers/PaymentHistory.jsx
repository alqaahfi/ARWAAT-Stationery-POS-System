import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, TextInput, Select, tableStyles, Tr } from '../../components/ui';
import PrintChoice from '../../components/PrintChoice';
import { formatCurrencyExact, formatDateTime } from '../../utils/format';

// Route: /ledgers/payments. A unified log across both customer and supplier
// payments — genuinely new, neither Customer Ledger nor Supplier Ledger shows
// a combined view.
export default function PaymentHistory({ onNavigate }) {
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partyType, setPartyType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [reprintingId, setReprintingId] = useState(null);

  useEffect(() => {
    if (user.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role, partyType, dateFrom, dateTo, method]);

  async function load(searchOverride) {
    setLoading(true);
    const data = await window.api.ledgers.getPaymentHistory({
      partyType: partyType || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      method: method || null,
      search: (searchOverride !== undefined ? searchOverride : search) || null,
    });
    setRows(data);
    setLoading(false);
  }

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  function goToLedger(row) {
    if (row.party_type === 'customer') onNavigate('/ledgers/customers', { id: row.party_id, name: row.party_name });
    else onNavigate('/ledgers/suppliers', { id: row.party_id, name: row.party_name });
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
      <PageHeader title="Payment History" />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <TextInput
            placeholder="Search party name…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: '180px' }}
          />
          <Select value={partyType} onChange={(e) => setPartyType(e.target.value)} style={{ width: '160px' }}>
            <option value="">All Parties</option>
            <option value="customer">Customer</option>
            <option value="supplier">Supplier</option>
          </Select>
          <Select value={method} onChange={(e) => setMethod(e.target.value)} style={{ width: '150px' }}>
            <option value="">All Methods</option>
            <option value="cash">Cash</option>
            <option value="bank">Bank</option>
            <option value="other">Other</option>
          </Select>
          <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '160px' }} />
          <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '160px' }} />
        </div>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Party</th>
                <th style={tableStyles.th}>Type</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Amount</th>
                <th style={tableStyles.th}>Method</th>
                <th style={tableStyles.th}>Linked Sale</th>
                <th style={tableStyles.th}>Recorded By</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <td style={tableStyles.td} onClick={() => goToLedger(r)}>
                    {formatDateTime(r.created_at)}
                  </td>
                  <td style={tableStyles.td} onClick={() => goToLedger(r)}>
                    {r.party_name || '—'}
                  </td>
                  <td style={tableStyles.td} onClick={() => goToLedger(r)}>
                    <span style={r.party_type === 'customer' ? styles.badgeCustomer : styles.badgeSupplier}>{r.party_type}</span>
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: theme.font.weightMedium }} onClick={() => goToLedger(r)}>
                    {formatCurrencyExact(r.amount)}
                  </td>
                  <td style={{ ...tableStyles.td, textTransform: 'capitalize' }} onClick={() => goToLedger(r)}>
                    {r.payment_method}
                  </td>
                  <td style={tableStyles.td} onClick={() => goToLedger(r)}>
                    {r.sale_invoice_no || 'Standalone'}
                  </td>
                  <td style={tableStyles.td} onClick={() => goToLedger(r)}>
                    {r.recorded_by_name || '—'}
                  </td>
                  <td style={tableStyles.td} onClick={(e) => e.stopPropagation()}>
                    {reprintingId === r.id ? (
                      <PrintChoice paymentId={r.id} inline onDone={() => setReprintingId(null)} />
                    ) : (
                      <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => setReprintingId(r.id)}>
                        Reprint Receipt
                      </Button>
                    )}
                  </td>
                </Tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} style={tableStyles.emptyState}>
                    No payments found.
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
  filterRow: { display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap' },
  badgeCustomer: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.infoBackground,
    color: theme.colors.info,
    fontSize: theme.font.sizeXs,
    textTransform: 'capitalize',
  },
  badgeSupplier: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warningBackground,
    color: theme.colors.warning,
    fontSize: theme.font.sizeXs,
    textTransform: 'capitalize',
  },
};
