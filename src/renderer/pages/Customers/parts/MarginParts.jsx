import React from 'react';
import { Percent, Trash2 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Banner, Button, Disclosure, EmptyState, Field, IconButton, Modal, NumberInput, SegmentedControl, Select } from '../../../components/ui';
import { formatCurrency } from '../../../utils/format';
import { PRICE_LEVELS, priceLevelLabel } from '../../../utils/priceLevel';

const c = theme.colors;

const STEPS = [
  "This customer's own special margin on the item.",
  "The special margin for the customer's Price Level.",
  "The item's special price for that Price Level.",
  "The item's own percentage setting (buying price plus a percentage).",
  'The normal retail or wholesale price.',
];

export function MarginsIntro() {
  return (
    <div style={{ marginBottom: theme.spacing.md }}>
      <p style={{ ...theme.type.body, color: c.labelSecondary, margin: `0 0 ${theme.spacing.smd}` }}>
        Sell selected items at your buying price plus a percentage — for one customer or for everyone on a Price Level.
      </p>
      <Disclosure title="How prices are worked out">
        <p style={{ ...theme.type.subhead, color: c.labelSecondary, margin: `0 0 ${theme.spacing.sm}` }}>
          When you sell an item to a customer, the app checks these in order and uses the first one that applies:
        </p>
        <ol style={{ ...theme.type.body, color: c.label, margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </Disclosure>
    </div>
  );
}

export function marginColumns({ onDelete }) {
  return [
    { key: 'product_name', label: 'Item', render: (r) => <span style={{ fontWeight: theme.font.weightMedium }}>{r.product_name}</span> },
    {
      key: 'target',
      label: 'Applies to',
      render: (r) =>
        r.customer_name ? <Badge tone="blue">{r.customer_name}</Badge> : <Badge tone="purple">{priceLevelLabel(r.customer_tier)}</Badge>,
    },
    { key: 'percentage', label: 'Margin', numeric: true, width: '110px', render: (r) => `+${Number(r.percentage)}%` },
    {
      key: 'remove',
      label: '',
      width: '52px',
      align: 'right',
      render: (r) => <IconButton icon={Trash2} tone="danger" label={`Remove margin for ${r.product_name}`} onClick={() => onDelete(r)} />,
    },
  ];
}

export function NoMargins({ onAdd }) {
  return (
    <EmptyState
      icon={Percent}
      color="purple"
      title="No special margins yet"
      message="Add one to sell an item at your buying price plus a percentage."
      action={<Button onClick={onAdd}>{glossary.addMargin}</Button>}
    />
  );
}

const TARGETS = [
  { value: 'customer', label: 'One customer' },
  { value: 'tier', label: 'A whole Price Level' },
];

export function AddMarginModal({ open, onClose, onSave, saving, products, customers, form, onChange, errors, formError }) {
  const pct = Number(form.percentage);
  const validPct = form.percentage !== '' && Number.isFinite(pct) && pct > 0;
  const noItems = products.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={glossary.addMargin}
      width={500}
      footer={
        noItems ? (
          <Button onClick={onClose}>OK</Button>
        ) : (
          <>
            <Button variant="plain" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={saving}>
              {glossary.addMargin}
            </Button>
          </>
        )
      }
    >
      {noItems ? (
        <Banner tone="info" style={{ marginTop: 0 }}>
          Only agency items can have special margins. Turn on &lsquo;{glossary.agencyItem}&rsquo; under More options when editing an item.
        </Banner>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave();
          }}
        >
          <Field label="Item" required error={errors.productId}>
            <Select id="margin-item" value={form.productId} onChange={(e) => onChange({ productId: e.target.value })}>
              <option value="">Choose an item…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <div style={{ marginBottom: theme.spacing.md }}>
            <div style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, marginBottom: '6px' }}>Applies to</div>
            <SegmentedControl label="Applies to" options={TARGETS} value={form.targetType} onChange={(v) => onChange({ targetType: v })} />
          </div>

          {form.targetType === 'customer' ? (
            <Field label="Customer" required error={errors.customerId}>
              <Select id="margin-customer" value={form.customerId} onChange={(e) => onChange({ customerId: e.target.value })}>
                <option value="">Choose a customer…</option>
                {customers.map((cu) => (
                  <option key={cu.id} value={cu.id}>
                    {cu.name}
                    {cu.is_active ? '' : ` (${glossary.inactive})`}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Price Level" required error={errors.customerTier}>
              <Select id="margin-tier" value={form.customerTier} onChange={(e) => onChange({ customerTier: e.target.value })}>
                <option value="">Choose a Price Level…</option>
                {PRICE_LEVELS.map((t) => (
                  <option key={t} value={t}>
                    {priceLevelLabel(t)}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Margin %" required error={errors.percentage} hint="Added on top of your buying price." style={{ marginBottom: 0 }}>
            <NumberInput
              id="margin-percentage"
              value={form.percentage}
              placeholder="e.g. 15"
              onChange={(e) => onChange({ percentage: cleanPercent(e.target.value) })}
              style={{ maxWidth: '160px' }}
            />
          </Field>

          {validPct && (
            <div style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary, marginTop: theme.spacing.smd }}>
              Example: an item you buy for {formatCurrency(100)} will sell for {formatCurrency(100 * (1 + pct / 100))}.
            </div>
          )}

          <Banner>{formError}</Banner>
          <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
        </form>
      )}
    </Modal>
  );
}

function cleanPercent(raw) {
  let v = raw.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  return v;
}
