import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, DataTable, useToast } from '../../components/ui';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, TableCard, ledgerPage } from './parts/LedgerParts';
import { PaymentsEmpty, PaymentsToolbar, paymentColumns } from './parts/PaymentsParts';
import { openAccount } from './parts/ledgerUtils';
import useDeletePayment from '../../utils/useDeletePayment';

// Route: /ledgers/payments. One log across customer and supplier payments,
// with filters and receipt reprints.
export default function PaymentHistory({ onNavigate }) {
  const { user } = useAuth();
  const toast = useToast();
  const deletePayment = useDeletePayment();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [partyType, setPartyType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState(null);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (user.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role, partyType, dateFrom, dateTo, method]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  async function load(searchOverride) {
    const req = ++requestRef.current;
    setLoading(true);
    setError(false);
    try {
      const data = await window.api.ledgers.getPaymentHistory({
        partyType: partyType || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        method: method || null,
        search: (searchOverride !== undefined ? searchOverride : search) || null,
      });
      if (req !== requestRef.current) return;
      setRows(data || []);
    } catch {
      if (req === requestRef.current) setError(true);
    }
    if (req === requestRef.current) setLoading(false);
  }

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  function clearFilters() {
    clearTimeout(debounceRef.current);
    setSearch('');
    setPartyType('');
    setMethod('');
    setDateFrom('');
    setDateTo('');
    // Only the search box doesn't trigger a reload by itself.
    if (!partyType && !method && !dateFrom && !dateTo) load('');
  }

  async function reprint(paymentId, format) {
    try {
      const res = await window.api.printing.printPaymentReceipt({ paymentId, format });
      if (!res?.success && !res?.canceled) toast.error(res?.reason || "The receipt couldn't be printed.");
    } catch {
      toast.error("The receipt couldn't be printed.");
    }
  }

  async function remove(row) {
    const gone = await deletePayment({ paymentId: row.id, amount: row.amount, partyName: row.party_name });
    if (gone) load();
  }

  const hasRecordedBy = rows.some((r) => r.recorded_by_name);
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);
  const columns = useMemo(
    () => paymentColumns({ hasRecordedBy, menuId, onMenu: setMenuId, onPrint: reprint, onDelete: remove, rowIndex }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasRecordedBy, menuId, rowIndex]
  );

  if (user.role !== 'admin') return <RestrictedNotice />;

  const filtered = !!(search.trim() || partyType || method || dateFrom || dateTo);

  return (
    <div style={ledgerPage}>
      <PageIntro>Every payment received from customers or paid to suppliers.</PageIntro>

      <PaymentsToolbar
        search={search}
        onSearch={handleSearchChange}
        partyType={partyType}
        onPartyType={setPartyType}
        method={method}
        onMethod={setMethod}
        dateFrom={dateFrom}
        onDateFrom={setDateFrom}
        dateTo={dateTo}
        onDateTo={setDateTo}
      />

      {error ? (
        <Card>
          <LoadError message="The payments couldn't be loaded." onRetry={() => load()} />
        </Card>
      ) : (
        <TableCard>
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading && !rows.length}
            onRowClick={(r) => openAccount(onNavigate, r.party_type, r.party_id, r.party_name)}
            emptyState={<PaymentsEmpty filtered={filtered} onClear={clearFilters} />}
            // Room for the reprint menu below the first rows of a short list.
            style={rows.length > 0 && rows.length < 4 ? { minHeight: '240px' } : undefined}
          />
        </TableCard>
      )}
    </div>
  );
}
