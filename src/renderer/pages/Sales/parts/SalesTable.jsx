import React, { useMemo } from 'react';
import { Ban, ChevronRight, Undo2 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Button, Card, DataTable, Icon } from '../../../components/ui';
import { formatCount, formatCurrencyExact, formatDateTime } from '../../../utils/format';
import { RETURN_STATUS, SALE_TYPE, STATUS } from './saleLabels';

const c = theme.colors;

export function SummaryStrip({ total, totals }) {
  const parts = [
    `${formatCount(total)} ${total === 1 ? 'sale' : 'sales'}`,
    `${formatCurrencyExact(totals.sumTotal)} total`,
    totals.sumBalanceDue > 0 ? `${formatCurrencyExact(totals.sumBalanceDue)} ${glossary.unpaidAtSale.toLowerCase()}` : null,
  ].filter(Boolean);
  return (
    <Card padding="10px 16px" style={{ marginBottom: theme.spacing.smd }}>
      <div style={styles.summary}>{parts.join(' · ')}</div>
    </Card>
  );
}

export function SalesTable({ rows, isAdmin, loading, onOpen, onVoid }) {
  const columns = useMemo(
    () =>
      [
        {
          key: 'invoice',
          label: 'Invoice',
          render: (r) => (
            <div>
              <div style={styles.strong}>{r.invoice_no}</div>
              <div style={styles.foot}>{formatDateTime(r.created_at)}</div>
            </div>
          ),
        },
        {
          key: 'customer',
          label: glossary.customer,
          render: (r) => (r.customer_name ? <span>{r.customer_name}</span> : <span style={{ color: c.labelSecondary }}>{glossary.walkIn}</span>),
        },
        {
          key: 'type',
          label: 'Type',
          width: '110px',
          render: (r) => {
            const t = SALE_TYPE[r.sale_type];
            return t ? <Badge tone={t.tone}>{t.label}</Badge> : null;
          },
        },
        isAdmin && { key: 'cashier', label: glossary.cashier, render: (r) => r.cashier_name },
        {
          key: 'total',
          label: 'Total',
          numeric: true,
          width: '130px',
          render: (r) => <span style={styles.strong}>{formatCurrencyExact(r.total_amount)}</span>,
        },
        {
          key: 'payment',
          label: 'Payment',
          width: '160px',
          render: (r) => {
            const s = STATUS[r.payment_status];
            const ret = RETURN_STATUS[r.return_status];
            return (
              <div>
                {r.is_voided ? <Badge tone="red">Voided</Badge> : s && <Badge tone={s.tone}>{s.label}</Badge>}
                {!r.is_voided && r.payment_status !== 'paid' && r.balance_due > 0 && (
                  <div style={{ ...styles.foot, ...theme.font.numeric }}>{formatCurrencyExact(r.balance_due)} unpaid</div>
                )}
                {ret && (
                  <div style={{ marginTop: '4px' }}>
                    <Badge tone="neutral">
                      <Icon icon={Undo2} size={12} />
                      {ret}
                    </Badge>
                    <div style={{ ...styles.foot, ...theme.font.numeric }}>{formatCurrencyExact(r.returned_amount)} returned</div>
                  </div>
                )}
              </div>
            );
          },
        },
        onVoid && {
          key: 'void',
          label: <span style={styles.srOnly}>Void</span>,
          width: '96px',
          render: (r) =>
            r.is_voided || r.return_status !== 'none' ? null : (
              <Button
                size="sm"
                variant="danger"
                icon={Ban}
                onClick={(e) => {
                  e.stopPropagation();
                  onVoid(r);
                }}
              >
                Void
              </Button>
            ),
        },
        {
          key: 'chevron',
          label: <span style={styles.srOnly}>Open</span>,
          width: '36px',
          render: () => <Icon icon={ChevronRight} size={16} style={{ color: c.labelTertiary, display: 'block' }} />,
        },
      ].filter(Boolean),
    [isAdmin, onVoid]
  );

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <DataTable columns={columns} rows={rows} loading={loading} onRowClick={onOpen} />
    </Card>
  );
}

const styles = {
  summary: { ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary },
  strong: { fontWeight: theme.font.weightSemibold, color: c.label },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  srOnly: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' },
};
