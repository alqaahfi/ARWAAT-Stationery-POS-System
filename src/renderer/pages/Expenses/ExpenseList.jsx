import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Button, TextInput, Select, tableStyles, Tr } from '../../components/ui';
import { formatCurrencyExact, formatDateOnly } from '../../utils/format';
import { RECURRENCE_OPTIONS, RECURRENCE_LABELS } from '../../utils/expenseRecurrence';

// Route: /expenses. The operational, day-to-day expense log — every expense
// lands here, whether entered as one-time or generated automatically from a
// recurring series (see ExpenseForm). Reports > Expense Report stays the
// analytical view (date-range chart + CSV/PDF export) over the same data.
export default function ExpenseList({ onNavigate }) {
  const { hasPermission } = useAuth();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [message, setMessage] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!hasPermission('manage_expenses')) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurrence, dateFrom, dateTo]);

  async function load(searchOverride) {
    setLoading(true);
    const res = await window.api.expenses.list({
      search: (searchOverride !== undefined ? searchOverride : search) || null,
      recurrence: recurrence || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
    setRows(res.rows);
    setTotal(res.total);
    setLoading(false);
  }

  function handleSearchChange(value) {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 250);
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete this expense — "${row.description}" (${formatCurrencyExact(row.amount)})?`)) return;
    await window.api.expenses.delete({ id: row.id });
    load();
  }

  async function handleStopRecurrence(row) {
    if (!window.confirm(`Stop the recurring "${row.description}" expense? Past occurrences are kept; no new ones will be added.`))
      return;
    const res = await window.api.expenses.stopRecurrence({ id: row.id });
    if (!res.success) {
      window.alert(res.reason || 'Could not stop recurrence.');
      return;
    }
    load();
  }

  async function handleExportPdf() {
    setPdfBusy(true);
    setMessage('');
    const res = await window.api.reports.exportPdf({
      reportType: 'expenses',
      filters: { search: search || null, recurrence: recurrence || null, dateFrom: dateFrom || null, dateTo: dateTo || null },
    });
    setPdfBusy(false);
    if (res.canceled) return;
    setMessage(res.success ? 'PDF exported.' : res.reason || 'Could not export PDF.');
  }

  if (!hasPermission('manage_expenses')) {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>You don't have permission to manage expenses</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Expenses"
        actions={
          <>
            <Button variant="secondary" onClick={handleExportPdf} disabled={pdfBusy}>
              {pdfBusy ? 'Exporting…' : 'Export PDF'}
            </Button>
            <Button onClick={() => onNavigate('/expenses/new')}>+ Add Expense</Button>
          </>
        }
      />

      <Card style={{ marginBottom: theme.spacing.md }}>
        <div style={styles.filterRow}>
          <TextInput
            placeholder="Search description or payee…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{ flex: 1, minWidth: '200px' }}
          />
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} style={{ width: '200px' }}>
            <option value="">All Recurrence Types</option>
            {RECURRENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: '160px' }} />
          <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: '160px' }} />
        </div>
        {message && <div style={styles.message}>{message}</div>}
      </Card>

      <Card style={{ marginBottom: theme.spacing.md, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: theme.colors.textSecondary, fontSize: theme.font.sizeSm }}>
          {rows.length} expense{rows.length === 1 ? '' : 's'}
        </span>
        <span style={{ fontSize: theme.font.sizeLg, fontWeight: theme.font.weightSemibold, color: theme.colors.textPrimary }}>
          Total: {formatCurrencyExact(total)}
        </span>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Date</th>
                <th style={tableStyles.th}>Description</th>
                <th style={tableStyles.th}>Payee</th>
                <th style={tableStyles.th}>Recurrence</th>
                <th style={{ ...tableStyles.th, textAlign: 'right' }}>Amount</th>
                <th style={tableStyles.th}>Paid By</th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <td style={tableStyles.td}>{formatDateOnly(r.expense_date)}</td>
                  <td style={tableStyles.td}>{r.description}</td>
                  <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>{r.payee || '—'}</td>
                  <td style={tableStyles.td}>
                    <span style={r.recurrence !== 'one_time' ? styles.recurringBadge : undefined}>
                      {RECURRENCE_LABELS[r.recurrence] || r.recurrence}
                    </span>
                  </td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', fontWeight: theme.font.weightMedium }}>
                    {formatCurrencyExact(r.amount)}
                  </td>
                  <td style={tableStyles.td}>{r.paid_by_name || '—'}</td>
                  <td style={{ ...tableStyles.td, textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" style={styles.actionBtn} onClick={() => onNavigate('/expenses/edit', { id: r.id })}>
                      Edit
                    </Button>{' '}
                    {r.recurring_expense_id && (
                      <>
                        <Button variant="ghost" style={styles.actionBtn} onClick={() => handleStopRecurrence(r)}>
                          Stop Recurrence
                        </Button>{' '}
                      </>
                    )}
                    <Button variant="ghost" style={{ ...styles.actionBtn, color: theme.colors.danger }} onClick={() => handleDelete(r)}>
                      Delete
                    </Button>
                  </td>
                </Tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} style={tableStyles.emptyState}>
                    No expenses found.
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
  actionBtn: { padding: '6px 12px', fontSize: theme.font.sizeXs },
  message: { marginTop: theme.spacing.sm, color: theme.colors.textSecondary, fontSize: theme.font.sizeSm },
  recurringBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    fontSize: theme.font.sizeXs,
    fontWeight: theme.font.weightMedium,
    backgroundColor: theme.colors.accentBlue + '22',
    color: theme.colors.accentBlue,
  },
};
