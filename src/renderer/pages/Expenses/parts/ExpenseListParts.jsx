import React, { memo, useState } from 'react';
import { FileDown, MoreHorizontal, Pencil, Plus, Receipt, Repeat, SearchX, Trash2 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, ChipGroup, EmptyState, IconButton, Menu, MenuDivider, MenuItem, Popover, SearchField, TextInput } from '../../../components/ui';
import { formatCurrencyExact } from '../../../utils/format';
import { TYPE_FILTERS, dayText, repeatLabel, weekdayText } from './expenseUi';

const c = theme.colors;

export function ExpenseToolbar({ search, onSearch, dateFrom, onDateFrom, dateTo, onDateTo, type, onType, onExport, exporting, onAdd }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.smd }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm }}>
        <SearchField
          value={search}
          onChange={onSearch}
          placeholder="Search paid to or notes"
          aria-label="Search paid to or notes"
          style={{ flex: '1 1 220px', minWidth: '200px' }}
        />
        <DateBox label="From" value={dateFrom} onChange={onDateFrom} />
        <DateBox label="To" value={dateTo} onChange={onDateTo} />
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginLeft: 'auto' }}>
          <Button variant="secondary" icon={FileDown} onClick={onExport} loading={exporting}>
            Export PDF
          </Button>
          <Button icon={Plus} onClick={onAdd}>
            {glossary.addExpense}
          </Button>
        </div>
      </div>
      <ChipGroup options={TYPE_FILTERS} value={type} onChange={onType} aria-label="Show expenses that repeat" />
    </div>
  );
}

function DateBox({ label, value, onChange }) {
  const id = `expenses-${label.toLowerCase()}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <label htmlFor={id} style={{ ...theme.type.subhead, color: c.labelSecondary }}>
        {label}
      </label>
      <TextInput id={id} type="date" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '150px' }} />
    </div>
  );
}

export function ExpenseSummary({ count, total }) {
  return (
    <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, margin: `${theme.spacing.smd} 0` }}>
      {count} expense{count === 1 ? '' : 's'} · {total} in total
    </div>
  );
}

function Stacked({ top, bottom, strong }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...theme.type.body, color: c.label, fontWeight: strong ? theme.font.weightSemibold : theme.font.weightNormal }}>{top}</div>
      {bottom && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{bottom}</div>}
    </div>
  );
}

export function expenseColumns({ onEdit, onStop, onDelete }) {
  return [
    {
      key: 'date',
      label: 'Date',
      width: '150px',
      render: (r) => <Stacked top={dayText(r.expense_date)} bottom={weekdayText(r.expense_date)} />,
    },
    {
      key: 'payee',
      label: glossary.paidTo,
      render: (r) => <Stacked strong top={r.payee || r.description} bottom={r.payee ? r.description : null} />,
    },
    {
      key: 'repeats',
      label: glossary.repeats,
      width: '140px',
      render: (r) =>
        repeatLabel(r.recurrence) ? (
          <Badge tone="blue">{repeatLabel(r.recurrence)}</Badge>
        ) : (
          <span style={{ ...theme.type.footnote, color: c.labelSecondary }}>{glossary.justOnce}</span>
        ),
    },
    {
      key: 'by',
      label: 'Added by',
      width: '140px',
      render: (r) => <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>{r.paid_by_name || '—'}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      numeric: true,
      width: '130px',
      render: (r) => <span style={{ fontWeight: theme.font.weightSemibold }}>{formatCurrencyExact(r.amount)}</span>,
    },
    {
      key: 'menu',
      label: <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Actions</span>,
      width: '52px',
      align: 'right',
      render: (r) => <RowMenu row={r} onEdit={onEdit} onStop={onStop} onDelete={onDelete} />,
    },
  ];
}

// Clicks and keys inside the menu never reach the (clickable) row.
const RowMenu = memo(function RowMenu({ row, onEdit, onStop, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'inline-flex' }}>
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        width={220}
        anchor={<IconButton icon={MoreHorizontal} label="More actions" size="sm" onClick={() => setOpen((o) => !o)} />}
      >
        {(close) => (
          <Menu label="Expense actions">
            <MenuItem
              icon={Pencil}
              label="Edit"
              onClick={() => {
                close();
                onEdit(row);
              }}
            />
            {row.recurring_expense_id && (
              <MenuItem
                icon={Repeat}
                label={glossary.stopRepeating}
                onClick={() => {
                  close(false);
                  onStop(row);
                }}
              />
            )}
            <MenuDivider />
            <MenuItem
              icon={Trash2}
              label="Delete"
              destructive
              onClick={() => {
                close(false);
                onDelete(row);
              }}
            />
          </Menu>
        )}
      </Popover>
    </span>
  );
});

export function NoExpenses({ onAdd }) {
  return (
    <EmptyState
      icon={Receipt}
      title="No expenses yet"
      message="Record rent, electricity, salaries and other shop costs here."
      action={
        <Button icon={Plus} onClick={onAdd}>
          {glossary.addExpense}
        </Button>
      }
      style={{ padding: '48px 24px' }}
    />
  );
}

export function NothingMatches({ onClear }) {
  return (
    <EmptyState
      icon={SearchX}
      title="Nothing matches"
      message="Try a different search or dates."
      action={
        <Button variant="tinted" onClick={onClear}>
          Clear filters
        </Button>
      }
      style={{ padding: '48px 24px' }}
    />
  );
}
