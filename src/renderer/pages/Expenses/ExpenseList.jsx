import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Card, DataTable, EmptyState, useConfirm, useToast } from '../../components/ui';
import { formatCurrency, formatCurrencyExact } from '../../utils/format';
import { LoadError } from '../Parties/PartyParts';
import { ExpenseSummary, ExpenseToolbar, NoExpenses, NothingMatches, expenseColumns } from './parts/ExpenseListParts';

// Route: /expenses. The operational, day-to-day expense log — every expense
// lands here, whether entered as one-time or generated automatically from a
// recurring series (see ExpenseForm). Reports > Expense Report stays the
// analytical view (date-range chart + CSV/PDF export) over the same data.
export default function ExpenseList({ onNavigate }) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_expenses');
  const toast = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const debounceRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (!canManage) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrence, dateFrom, dateTo]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  async function load(searchOverride) {
    const id = ++requestRef.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await window.api.expenses.list({
        search: (searchOverride !== undefined ? searchOverride : search) || null,
        recurrence: recurrence || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      });
      if (id !== requestRef.current) return;
      setRows(res.rows);
      setTotal(res.total);
    } catch {
      if (id === requestRef.current) setLoadFailed(true);
    } finally {
      if (id === requestRef.current) setLoading(false);
    }
  }

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  function clearFilters() {
    clearTimeout(debounceRef.current);
    const onlySearch = !recurrence && !dateFrom && !dateTo;
    setSearch('');
    setRecurrence('');
    setDateFrom('');
    setDateTo('');
    // Changing the other filters reloads on its own.
    if (onlySearch) load('');
  }

  function openEdit(row) {
    onNavigate('/expenses/edit', { id: row.id });
  }

  async function handleDelete(row) {
    const ok = await confirm({
      title: 'Delete this expense?',
      message: `"${row.description}" (${formatCurrencyExact(row.amount)}) will be removed. This can't be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await window.api.expenses.delete({ id: row.id });
      toast.success('Expense deleted');
    } catch {
      toast.error('Could not delete the expense.');
    }
    load();
  }

  async function handleStopRecurrence(row) {
    const ok = await confirm({
      title: 'Stop repeating this expense?',
      message: 'Expenses already added will stay. No new ones will be added.',
      confirmLabel: glossary.stopRepeating,
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await window.api.expenses.stopRecurrence({ id: row.id });
      if (!res.success) {
        toast.error(res.reason || 'Could not stop repeating.');
        return;
      }
      toast.success('This expense no longer repeats');
    } catch {
      toast.error('Could not stop repeating.');
    }
    load();
  }

  async function handleExportPdf() {
    setPdfBusy(true);
    try {
      const res = await window.api.reports.exportPdf({
        reportType: 'expenses',
        filters: { search: search || null, recurrence: recurrence || null, dateFrom: dateFrom || null, dateTo: dateTo || null },
      });
      if (res.canceled) return;
      if (res.success) toast.success('PDF exported.');
      else toast.error(res.reason || 'Could not export PDF.');
    } catch {
      toast.error('Could not export PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  const columns = expenseColumns({ onEdit: openEdit, onStop: handleStopRecurrence, onDelete: handleDelete });

  if (!canManage) {
    return (
      <Card padding="0" style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState icon={Lock} title="You can't manage expenses" message={'Ask your admin to turn on "Manage Expenses" for your account.'} style={{ padding: '48px 24px' }} />
      </Card>
    );
  }

  const filtered = !!(search.trim() || recurrence || dateFrom || dateTo);
  const addExpense = () => onNavigate('/expenses/new');

  return (
    <div style={{ paddingBottom: '48px' }}>
      <ExpenseToolbar
        search={search}
        onSearch={handleSearchChange}
        dateFrom={dateFrom}
        onDateFrom={setDateFrom}
        dateTo={dateTo}
        onDateTo={setDateTo}
        type={recurrence}
        onType={setRecurrence}
        onExport={handleExportPdf}
        exporting={pdfBusy}
        onAdd={addExpense}
      />

      {!loadFailed && !(loading && !rows.length) ? (
        <ExpenseSummary count={rows.length} total={formatCurrency(total)} />
      ) : (
        <div style={{ height: theme.spacing.md }} />
      )}

      <Card padding="0" style={{ overflow: 'hidden' }}>
        {loadFailed ? (
          <LoadError message="The expenses couldn't be loaded." onRetry={() => load()} />
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            loading={loading && !rows.length}
            onRowClick={openEdit}
            emptyState={filtered ? <NothingMatches onClear={clearFilters} /> : <NoExpenses onAdd={addExpense} />}
          />
        )}
      </Card>
    </div>
  );
}
