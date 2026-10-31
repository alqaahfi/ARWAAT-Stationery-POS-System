import React, { useCallback, useEffect, useState } from 'react';
import { Tag, Plus, Pencil, Trash2, Package } from 'lucide-react';
import theme from '../../../config/theme';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  IconButton,
  Modal,
  NumberInput,
  Select,
  Spinner,
  useConfirm,
  useToast,
} from '../../../components/ui';
import { formatCurrency } from '../../../utils/format';

const c = theme.colors;

export default function SpecialPricingCard({ customerId }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const toast = useToast();
  const confirm = useConfirm();

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await window.api.customers.getSpecialPrices({ customerId });
      setRules(rows || []);
    } catch {
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  async function handleDelete(rule) {
    const ok = await confirm({
      title: 'Remove special pricing?',
      message: `Remove special price for ${rule.product_name}? This customer will pay regular rates.`,
      confirmLabel: 'Remove',
      confirmTone: 'danger',
    });
    if (!ok) return;

    const res = await window.api.customers.deleteSpecialPrice({ id: rule.id });
    if (res?.success) {
      toast.success('Special price removed.');
      loadRules();
    } else {
      toast.error(res?.reason || 'Could not remove special price.');
    }
  }

  function openAdd() {
    setEditingRule(null);
    setModalOpen(true);
  }

  function openEdit(rule) {
    setEditingRule(rule);
    setModalOpen(true);
  }

  return (
    <Card padding={theme.spacing.md} style={{ marginTop: theme.spacing.md }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <Tag size={18} color={c.accent} />
          <h2 style={{ ...theme.type.headline, color: c.label, margin: 0 }}>Special Pricing</h2>
          <Badge tone={rules.length > 0 ? 'blue' : 'neutral'}>{rules.length}</Badge>
        </div>
        <Button size="sm" icon={Plus} onClick={openAdd}>
          Add Special Price
        </Button>
      </div>

      {loading ? (
        <div style={{ padding: theme.spacing.xl, textAlign: 'center' }}>
          <Spinner size={24} />
        </div>
      ) : rules.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No special prices set"
          message="Set custom fixed prices, discount percentages, or profit margins on specific products for this customer."
          action={
            <Button size="sm" icon={Plus} onClick={openAdd}>
              Add Special Price
            </Button>
          }
        />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${c.separatorStrong}` }}>
                <th style={{ ...styles.th }}>Product</th>
                <th style={{ ...styles.th }}>Pack Size</th>
                <th style={{ ...styles.th }}>Pricing Type</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Special Rate</th>
                <th style={{ ...styles.th, width: '80px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${c.separator}` }}>
                  <td style={{ ...styles.td }}>
                    <div style={{ fontWeight: theme.font.weightSemibold, color: c.label }}>{r.product_name}</div>
                    {r.product_sku && <div style={{ ...theme.type.caption, color: c.labelSecondary }}>{r.product_sku}</div>}
                  </td>
                  <td style={{ ...styles.td }}>
                    <Badge tone={r.unit_name ? 'neutral' : 'indigo'}>
                      {r.unit_name ? r.unit_name : 'All pack sizes'}
                    </Badge>
                  </td>
                  <td style={{ ...styles.td }}>
                    {r.pricing_type === 'fixed' && <Badge tone="green">Fixed Price</Badge>}
                    {r.pricing_type === 'discount_percent' && <Badge tone="orange">Discount %</Badge>}
                    {r.pricing_type === 'margin_percent' && <Badge tone="purple">Margin %</Badge>}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', ...theme.font.numeric, fontWeight: theme.font.weightSemibold }}>
                    {r.pricing_type === 'fixed' && formatCurrency(r.price)}
                    {r.pricing_type === 'discount_percent' && `${Number(r.percentage)}% off standard`}
                    {r.pricing_type === 'margin_percent' && `+${Number(r.percentage)}% over cost`}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '4px' }}>
                      <IconButton icon={Pencil} size="sm" label="Edit" onClick={() => openEdit(r)} />
                      <IconButton icon={Trash2} size="sm" tone="danger" label="Delete" onClick={() => handleDelete(r)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <SpecialPriceModal
          customerId={customerId}
          rule={editingRule}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            loadRules();
          }}
        />
      )}
    </Card>
  );
}

function SpecialPriceModal({ customerId, rule, onClose, onSaved }) {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(rule?.product_id ? String(rule.product_id) : '');
  const [packSizes, setPackSizes] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState(rule?.product_unit_id ? String(rule.product_unit_id) : '');
  const [pricingType, setPricingType] = useState(rule?.pricing_type || 'fixed');
  const [price, setPrice] = useState(rule?.price !== null && rule?.price !== undefined ? String(rule.price) : '');
  const [percentage, setPercentage] = useState(rule?.percentage !== null && rule?.percentage !== undefined ? String(rule.percentage) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load products list for dropdown
  useEffect(() => {
    window.api.products.list({ limit: 500, activeOnly: true }).then((res) => {
      setProducts(res?.products || res || []);
    }).catch(() => setProducts([]));
  }, []);

  // When selected product changes, load its units/pack sizes
  useEffect(() => {
    if (!selectedProductId) {
      setPackSizes([]);
      return;
    }
    window.api.products.getById({ id: Number(selectedProductId) }).then((p) => {
      setPackSizes(p?.units || []);
    }).catch(() => setPackSizes([]));
  }, [selectedProductId]);

  async function handleSave() {
    setError('');
    if (!selectedProductId) {
      setError('Please select a product.');
      return;
    }

    if (pricingType === 'fixed') {
      const p = Number(price);
      if (isNaN(p) || p < 0 || price === '') {
        setError('Please enter a valid price (Rs).');
        return;
      }
    } else {
      const pct = Number(percentage);
      if (isNaN(pct) || pct < 0 || percentage === '') {
        setError('Please enter a valid percentage.');
        return;
      }
    }

    setSaving(true);
    const payload = {
      id: rule?.id,
      customerId,
      productId: Number(selectedProductId),
      productUnitId: selectedUnitId ? Number(selectedUnitId) : null,
      pricingType,
      price: pricingType === 'fixed' ? Number(price) : null,
      percentage: pricingType !== 'fixed' ? Number(percentage) : null,
    };

    const res = await window.api.customers.saveSpecialPrice(payload);
    setSaving(false);

    if (res?.success) {
      toast.success(rule ? 'Special price updated.' : 'Special price added.');
      onSaved();
    } else {
      setError(res?.reason || 'Failed to save special price.');
    }
  }

  const productOptions = products.map((p) => ({
    value: String(p.id),
    label: `${p.name}${p.sku ? ` (${p.sku})` : ''}`,
  }));

  const unitOptions = [
    { value: '', label: 'All pack sizes (whole product)' },
    ...packSizes.map((u) => ({
      value: String(u.id),
      label: `${u.unit_name || 'Unit'} (${formatCurrency(u.retail_price)})`,
    })),
  ];

  const typeOptions = [
    { value: 'fixed', label: 'Fixed Price (Rs.)' },
    { value: 'discount_percent', label: 'Discount % off standard price' },
    { value: 'margin_percent', label: 'Margin % over buying cost' },
  ];

  return (
    <Modal
      open
      title={rule ? 'Edit Special Price' : 'Add Special Price'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        <Field label="Product" required>
          <Select
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setSelectedUnitId('');
            }}
            options={[{ value: '', label: 'Select a product…' }, ...productOptions]}
            disabled={!!rule}
          />
        </Field>

        <Field label="Pack Size / Unit Scope" hint="Apply to all pack sizes or a specific one">
          <Select
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
            options={unitOptions}
            disabled={!selectedProductId}
          />
        </Field>

        <Field label="Special Pricing Method" required>
          <Select
            value={pricingType}
            onChange={(e) => setPricingType(e.target.value)}
            options={typeOptions}
          />
        </Field>

        {pricingType === 'fixed' ? (
          <Field label="Special Selling Price (Rs.)" required hint="The exact unit price charged to this customer">
            <NumberInput
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 150"
              min={0}
              step="any"
              autoFocus
            />
          </Field>
        ) : pricingType === 'discount_percent' ? (
          <Field label="Special Discount Percentage (%)" required hint="Subtracted from the standard retail or wholesale price">
            <NumberInput
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="e.g. 10 for 10% off"
              min={0}
              max={100}
              step="any"
              autoFocus
            />
          </Field>
        ) : (
          <Field label="Special Margin Percentage (%)" required hint="Added on top of unit buying cost: cost × (1 + %/100)">
            <NumberInput
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="e.g. 15 for 15% margin"
              min={0}
              step="any"
              autoFocus
            />
          </Field>
        )}

        {error && (
          <div style={{ ...theme.type.footnote, color: c.redText, backgroundColor: c.redTint, padding: '8px 12px', borderRadius: theme.radius.sm }}>
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

const styles = {
  th: {
    padding: '8px 12px',
    fontSize: theme.type.footnote.fontSize,
    fontWeight: theme.font.weightSemibold,
    color: c.labelSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '10px 12px',
    fontSize: theme.type.subhead.fontSize,
    color: c.label,
    verticalAlign: 'middle',
  },
};
