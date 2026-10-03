import React, { useMemo } from 'react';
import theme from '../../../../config/theme';
import glossary from '../../../../config/glossary';
import { Button, Card, Checkbox, ChipGroup, DataTable, Field, Label, NumberInput, Textarea } from '../../../../components/ui';
import { formatCurrencyExact } from '../../../../utils/format';
import { formatLocalDateTime } from '../saleLabels';
import { REASON_OPTIONS, formatQty, packLine, round2 } from './returnUtils';

const c = theme.colors;

export function SaleSummaryLine({ sale, customer }) {
  return (
    <p style={styles.summary}>
      <strong style={{ color: c.label }}>{sale.invoice_no}</strong>
      {' · '}
      {formatLocalDateTime(sale.created_at)}
      {' · '}
      {customer ? customer.name : glossary.walkIn}
      {' · '}
      <span style={theme.font.numeric}>{formatCurrencyExact(sale.total_amount)}</span>
    </p>
  );
}

// Step 2: how many of each line are coming back, why, and whether they go back on the shelf.
export function ItemsStep({ data, qty, onQty, onReturnAll, reason, onReason, note, onNote, restock, onRestock, total }) {
  const columns = useMemo(
    () => [
      {
        key: 'item',
        label: 'Item',
        render: (l) => (
          <div>
            <div style={{ fontWeight: theme.font.weightSemibold }}>{l.item_name}</div>
            {packLine(l) && <div style={styles.foot}>{packLine(l)}</div>}
          </div>
        ),
      },
      { key: 'sold', label: 'Sold', numeric: true, width: '70px', render: (l) => formatQty(l.quantity_sold) },
      {
        key: 'returned',
        label: 'Already returned',
        numeric: true,
        width: '130px',
        render: (l) => (l.quantity_returned > 0 ? formatQty(l.quantity_returned) : '—'),
      },
      {
        key: 'return',
        label: 'Return',
        width: '110px',
        align: 'right',
        render: (l) => (
          <NumberInput
            value={qty[l.sale_item_id] ?? ''}
            placeholder="0"
            disabled={l.returnable <= 0}
            aria-label={`Quantity of ${l.item_name} to return, up to ${formatQty(l.returnable)}`}
            onFocus={(e) => e.target.select()}
            onWheel={(e) => e.currentTarget.blur()}
            onChange={(e) => onQty(l, e.target.value)}
            style={{ width: '90px', height: '34px' }}
          />
        ),
      },
      {
        key: 'value',
        label: 'Value',
        numeric: true,
        width: '120px',
        render: (l) => formatCurrencyExact(round2((Number(qty[l.sale_item_id]) || 0) * l.unit_refund_value)),
      },
    ],
    [qty, onQty]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxWidth: '900px' }}>
      <SaleSummaryLine sale={data.sale} customer={data.customer} />

      <Card padding="0" style={{ overflow: 'hidden' }}>
        <DataTable columns={columns} rows={data.lines} rowKey="sale_item_id" dense />
        <div style={styles.tableFoot}>
          <Button variant="plain" size="sm" onClick={onReturnAll}>
            Return everything
          </Button>
          <div style={{ textAlign: 'right' }} aria-live="polite">
            <div style={styles.foot}>Value of returned items</div>
            <div style={{ ...theme.type.title2, ...theme.font.numeric, color: c.label }}>{formatCurrencyExact(total)}</div>
          </div>
        </div>
      </Card>

      <Card>
        <Label style={{ marginTop: 0 }}>
          Reason<span style={{ color: c.redText }}> *</span>
        </Label>
        <ChipGroup options={REASON_OPTIONS} value={reason} onChange={onReason} aria-label="Reason" />
        <Field label="Note (optional)" style={{ marginTop: theme.spacing.md, marginBottom: 0 }}>
          <Textarea value={note} onChange={(e) => onNote(e.target.value)} rows={2} maxLength={500} />
        </Field>
        <Checkbox id="return-restock" label={glossary.addBackToStock} checked={restock} onChange={(e) => onRestock(e.target.checked)} />
        <div style={{ ...styles.foot, marginLeft: '28px' }}>Turn this off if the items are damaged and can't be sold again.</div>
      </Card>
    </div>
  );
}

const styles = {
  summary: { ...theme.type.subhead, color: c.labelSecondary, margin: 0 },
  foot: { ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' },
  tableFoot: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: `${theme.spacing.smd} ${theme.spacing.md}`,
    backgroundColor: c.surfaceAlt,
  },
};
