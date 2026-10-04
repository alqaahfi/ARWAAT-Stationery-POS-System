import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Printer, SearchX, Undo2 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Avatar, Badge, Button, Checkbox, DataTable, EmptyState, Icon, Modal, Skeleton } from '../../../components/ui';
import { formatCurrencyExact, formatDateTime } from '../../../utils/format';
import { methodLabel } from '../../Ledgers/parts/ledgerUtils';
import PrintPreviewModal from '../../../components/receipt/PrintPreviewModal';
import { RETURN_STATUS, SALE_TYPE, STATUS, formatLocalDateTime } from './saleLabels';

const c = theme.colors;

// Read-only view of one sale, with reprint. No void/edit here; an Admin can
// start a return, which happens on the Returns page.
export function SaleDetailSheet({ saleId, userId, isAdmin, onClose, onOpenCustomer, onReturnItems, onOpenReturn }) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [showDues, setShowDues] = useState(false);
  const [preview, setPreview] = useState(null); // { printType } while the print preview is open

  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      const res = await window.api.sales.getDetail({ id: saleId, requestingUserId: userId });
      if (!res?.success) {
        setState({ loading: false, error: res?.notFound ? 'notFound' : 'failed', data: null });
        return;
      }
      setState({ loading: false, error: null, data: res });
      setShowDues(!!res.customer && res.customer.balance > 0);
    } catch {
      setState({ loading: false, error: 'failed', data: null });
    }
  }, [saleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reprints go through the print preview too — nothing reaches the printer
  // until Print is pressed inside it.
  function print(printType) {
    setPreview({ printType });
  }

  const { data } = state;
  const sale = data?.sale;
  const status = sale && STATUS[sale.payment_status];
  const returnBadge = sale && RETURN_STATUS[sale.return_status];

  const title = sale ? (
    <span style={styles.titleRow}>
      {sale.invoice_no}
      {status && <Badge tone={status.tone}>{status.label}</Badge>}
      {returnBadge && (
        <Badge tone="neutral">
          <Icon icon={Undo2} size={12} />
          {returnBadge}
        </Badge>
      )}
    </span>
  ) : (
    'Sale'
  );
  const subtitle = sale
    ? [formatLocalDateTime(sale.created_at), `Sold by ${sale.cashier_name}`, sale.origin_pc && `Computer ${sale.origin_pc}`].filter(Boolean).join(' · ')
    : undefined;

  const isRetail = sale?.sale_type !== 'wholesale';
  const footer = (
    <>
      <Button variant="plain" onClick={onClose} style={{ marginRight: 'auto' }}>
        Close
      </Button>
      {sale && isAdmin && onReturnItems && sale.return_status !== 'full' && (
        <Button variant="tinted" icon={Undo2} onClick={() => onReturnItems(sale.id)}>
          {glossary.returnItems}
        </Button>
      )}
      {sale && (
        <>
          <Button
            variant="tinted"
            icon={Printer}
            onClick={() => print(isRetail ? 'wholesale-a4' : 'retail-thermal')}
          >
            {isRetail ? glossary.a4Invoice : glossary.smallReceipt}
          </Button>
          <Button
            icon={Printer}
            onClick={() => print(isRetail ? 'retail-thermal' : 'wholesale-a4')}
          >
            {isRetail ? 'Print receipt' : 'Print A4 invoice'}
          </Button>
        </>
      )}
    </>
  );

  let body;
  if (state.loading) {
    body = <Skeleton lines={6} height="20px" />;
  } else if (state.error === 'notFound') {
    body = <EmptyState icon={SearchX} title="This sale can't be opened" message="It may belong to someone else, or it no longer exists." />;
  } else if (state.error) {
    body = (
      <div role="alert" style={styles.errorBox}>
        <Icon icon={CircleAlert} size={18} />
        <span style={{ flex: 1 }}>Couldn't load this sale.</span>
        <Button size="sm" variant="tinted" onClick={load}>
          Try again
        </Button>
      </div>
    );
  } else {
    body = (
      <SaleBody
        data={data}
        isAdmin={isAdmin}
        onOpenCustomer={onOpenCustomer}
        onOpenReturn={onOpenReturn}
        showDues={showDues}
        onShowDues={setShowDues}
      />
    );
  }

  return (
    <Modal open onClose={onClose} title={title} subtitle={subtitle} width={720} footer={footer}>
      {body}
      {preview && sale && (
        <PrintPreviewModal
          saleId={sale.id}
          printType={preview.printType}
          showDues={showDues && !!data.customer}
          onClose={() => setPreview(null)}
        />
      )}
    </Modal>
  );
}

function SaleBody({ data, isAdmin, onOpenCustomer, onOpenReturn, showDues, onShowDues }) {
  const { sale, customer, lines, payments, returns = [] } = data;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <CustomerRow customer={customer} isAdmin={isAdmin} onOpenCustomer={onOpenCustomer} />
      <ItemsTable lines={lines} />
      <Totals sale={sale} />
      {payments.length > 0 && <PaymentsList payments={payments} />}
      {returns.length > 0 && <ReturnsList returns={returns} onOpenReturn={isAdmin ? onOpenReturn : null} />}
      {customer && (
        <Checkbox id="sale-show-dues" label={glossary.showDuesOnReceipt} checked={showDues} onChange={(e) => onShowDues(e.target.checked)} />
      )}
    </div>
  );
}

function CustomerRow({ customer, isAdmin, onOpenCustomer }) {
  const name = customer?.name || glossary.walkIn;
  const type = customer && SALE_TYPE[customer.type];
  return (
    <div style={styles.customerRow}>
      <Avatar name={name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={styles.customerLine}>
          {customer && isAdmin ? (
            <Button variant="plain" size="sm" onClick={() => onOpenCustomer(customer)} style={{ padding: '0 4px', marginLeft: '-4px' }}>
              {name}
            </Button>
          ) : (
            <span style={{ fontWeight: theme.font.weightSemibold, color: customer ? c.label : c.labelSecondary }}>{name}</span>
          )}
          {type && (
            <Badge tone={type.tone} size="sm">
              {type.label}
            </Badge>
          )}
        </div>
        {customer?.phone && <div style={styles.foot}>{customer.phone}</div>}
      </div>
    </div>
  );
}

function ItemsTable({ lines }) {
  const hasDiscount = lines.some((l) => l.discount_amount > 0);
  const hasReturned = lines.some((l) => l.quantity_returned > 0);
  const columns = useMemo(
    () =>
      [
        {
          key: 'item',
          label: 'Item',
          render: (l) => (
            <div>
              <div style={{ fontWeight: theme.font.weightSemibold }}>{l.item_name}</div>
              <div style={styles.foot}>{[l.variant_name, l.unit_name].filter(Boolean).join(' · ')}</div>
            </div>
          ),
        },
        { key: 'quantity', label: 'Qty', numeric: true, width: '70px', render: (l) => Number(l.quantity).toLocaleString('en-US') },
        { key: 'unit_price', label: 'Price', numeric: true, width: '110px', render: (l) => formatCurrencyExact(l.unit_price) },
        hasDiscount && {
          key: 'discount',
          label: 'Discount',
          numeric: true,
          width: '100px',
          render: (l) => (l.discount_amount > 0 ? `−${formatCurrencyExact(l.discount_amount)}` : '—'),
        },
        { key: 'line_total', label: 'Total', numeric: true, width: '120px', render: (l) => formatCurrencyExact(l.line_total) },
        hasReturned && {
          key: 'returned',
          label: glossary.returned,
          numeric: true,
          width: '90px',
          render: (l) => (l.quantity_returned > 0 ? Number(l.quantity_returned).toLocaleString('en-US') : '—'),
        },
      ].filter(Boolean),
    [hasDiscount, hasReturned]
  );
  return (
    <div style={styles.tableBox}>
      <DataTable columns={columns} rows={lines} dense maxHeight="260px" />
    </div>
  );
}

function Totals({ sale }) {
  return (
    <div style={styles.totals}>
      <TotalLine label="Subtotal" value={formatCurrencyExact(sale.subtotal)} />
      {sale.discount_amount > 0 && <TotalLine label="Discount" value={`−${formatCurrencyExact(sale.discount_amount)}`} />}
      {sale.tax_amount > 0 && <TotalLine label="Tax" value={formatCurrencyExact(sale.tax_amount)} />}
      <TotalLine label="Total" value={formatCurrencyExact(sale.total_amount)} big />
      <TotalLine label="Paid" value={formatCurrencyExact(sale.paid_amount)} />
      {sale.balance_due > 0 && <TotalLine label={glossary.unpaidAtSale} value={formatCurrencyExact(sale.balance_due)} color={c.orangeText} />}
    </div>
  );
}

function TotalLine({ label, value, big, color }) {
  const text = big ? theme.type.title2 : theme.type.body;
  return (
    <div style={{ ...styles.totalLine, color: color || (big ? c.label : c.labelSecondary) }}>
      <span style={big ? { ...text } : null}>{label}</span>
      <span style={{ ...text, ...theme.font.numeric, fontWeight: big ? theme.font.weightSemibold : undefined, color: color || c.label, minWidth: '120px', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

function PaymentsList({ payments }) {
  return (
    <div>
      <div style={styles.sectionLabel}>{glossary.payments}</div>
      {payments.map((p) => (
        <div key={p.id} style={styles.paymentRow}>
          <span style={{ color: c.labelSecondary }}>{formatDateTime(p.created_at)}</span>
          <span style={{ flex: 1 }}>{methodLabel(p.payment_method)}</span>
          <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: c.greenText }}>{formatCurrencyExact(p.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function ReturnsList({ returns, onOpenReturn }) {
  return (
    <div>
      <div style={styles.sectionLabel}>{glossary.returns}</div>
      {returns.map((r) => (
        <div key={r.id} style={styles.paymentRow}>
          {onOpenReturn ? (
            <Button variant="plain" size="sm" onClick={() => onOpenReturn(r.id)} style={{ padding: '0 4px', marginLeft: '-4px' }}>
              {r.return_no}
            </Button>
          ) : (
            <span style={{ fontWeight: theme.font.weightSemibold }}>{r.return_no}</span>
          )}
          <span style={{ flex: 1, color: c.labelSecondary }}>{formatDateTime(r.created_at)}</span>
          {r.cash_refund_amount > 0 && (
            <span style={{ ...theme.font.numeric, color: c.labelSecondary }}>Cash back {formatCurrencyExact(r.cash_refund_amount)}</span>
          )}
          <span style={{ ...theme.font.numeric, fontWeight: theme.font.weightSemibold }}>{formatCurrencyExact(r.total_amount)}</span>
        </div>
      ))}
    </div>
  );
}

const styles = {
  titleRow: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  customerRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd },
  customerLine: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  tableBox: { border: `1px solid ${c.separator}`, borderRadius: theme.radius.md, overflow: 'hidden' },
  totals: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' },
  totalLine: { display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: theme.spacing.md },
  sectionLabel: { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary, marginBottom: '4px' },
  paymentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: '8px 0',
    borderTop: `1px solid ${c.separator}`,
    ...theme.type.subhead,
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    backgroundColor: c.redTint,
    color: c.redText,
    ...theme.type.subhead,
  },
};
