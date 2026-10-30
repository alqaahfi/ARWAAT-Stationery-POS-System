import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import theme from '../../config/theme';
import { Banner, Card, DataTable, EmptyState } from '../../components/ui';
import { formatLocalDateTime } from '../Sales/parts/saleLabels';

const c = theme.colors;

// Rule 12: every Admin approval given on a cashier screen — what, bill, cashier, admin, when.
export default function ApprovalsLog() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.approvals
      .list({ limit: 500 })
      .then((res) => {
        if (!res?.success) throw new Error(res?.reason);
        setRows(res.rows);
      })
      .catch(() => setError("The approvals couldn't be loaded."));
  }, []);

  const columns = [
    { key: 'created_at', label: 'When', width: '170px', render: (r) => formatLocalDateTime(r.created_at) },
    {
      key: 'actionText',
      label: 'What',
      render: (r) => (
        <div>
          <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold }}>{r.actionText}</div>
          {r.details && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{r.details}</div>}
        </div>
      ),
    },
    { key: 'invoice_no', label: 'Bill', width: '170px', render: (r) => r.invoice_no || '—' },
    { key: 'cashier_name', label: 'Cashier', width: '150px', render: (r) => r.cashier_name || '—' },
    { key: 'admin_name', label: 'Approved by', width: '150px', render: (r) => r.admin_name || '—' },
  ];

  return (
    <div style={{ paddingBottom: '48px' }}>
      <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginBottom: theme.spacing.md }}>
        Every time you approved something on a cashier screen: a bigger discount, selling without stock, or changing / voiding an
        older bill.
      </div>
      <Banner tone="error">{error}</Banner>
      <Card padding="0">
        <DataTable
          columns={columns}
          rows={rows || []}
          loading={rows === null && !error}
          emptyState={<EmptyState icon={ShieldCheck} title="No approvals yet" message="Approvals given on a cashier screen show up here." />}
        />
      </Card>
    </div>
  );
}
