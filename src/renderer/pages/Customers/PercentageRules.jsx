import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Button, Card, DataTable, useConfirm, useToast } from '../../components/ui';
import { priceLevelLabel } from '../../utils/priceLevel';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { AddMarginModal, MarginsIntro, NoMargins, marginColumns } from './parts/MarginParts';

const EMPTY_FORM = { productId: '', targetType: 'customer', customerId: '', customerTier: '', percentage: '' };

// Turns the handler's wording into the words this page uses.
function plainReason(reason) {
  if (!reason) return 'Could not add this margin. Please try again.';
  return reason
    .replace('Select a product.', 'Choose an item.')
    .replace('Select a tier.', 'Choose a Price Level.')
    .replace('Select a customer.', 'Choose a customer.')
    .replace('Choose a target: specific customer or whole tier.', 'Choose who this margin applies to.');
}

export default function PercentageRules() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    const rows = await window.api.percentageRules.list();
    setRules(rows || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [ruleRows, productRows, customerRows] = await Promise.all([
        window.api.percentageRules.list(),
        window.api.percentageRules.listEligibleProducts(),
        window.api.customers.list(),
      ]);
      setRules(ruleRows || []);
      setProducts(productRows || []);
      setCustomers(customerRows || []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function openModal() {
    setForm(EMPTY_FORM);
    setErrors({});
    setFormError('');
    setModalOpen(true);
  }

  function changeForm(patch) {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
    setFormError('');
  }

  function validate() {
    const next = {};
    if (!form.productId) next.productId = 'Choose an item.';
    if (form.targetType === 'customer' && !form.customerId) next.customerId = 'Choose a customer.';
    if (form.targetType === 'tier' && !form.customerTier) next.customerTier = 'Choose a Price Level.';
    const pct = Number(form.percentage);
    if (form.percentage === '' || !Number.isFinite(pct) || pct <= 0) next.percentage = 'Enter a margin above 0%.';
    return next;
  }

  // The rules list only carries names, so a duplicate is the same item name
  // with the same customer name or Price Level.
  function isDuplicate() {
    const productName = products.find((p) => String(p.id) === String(form.productId))?.name;
    if (form.targetType === 'customer') {
      const customerName = customers.find((c) => String(c.id) === String(form.customerId))?.name;
      return rules.some((r) => r.product_name === productName && r.customer_name && r.customer_name === customerName);
    }
    return rules.some((r) => r.product_name === productName && !r.customer_name && r.customer_tier === form.customerTier);
  }

  async function handleAdd() {
    if (saving) return;
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      const first = found.productId ? 'margin-item' : found.customerId ? 'margin-customer' : found.customerTier ? 'margin-tier' : 'margin-percentage';
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }
    if (isDuplicate()) {
      const who =
        form.targetType === 'customer' ? 'this customer' : `everyone on ${priceLevelLabel(form.customerTier)}`;
      setFormError(`This item already has a special margin for ${who}. Remove the old one first if you want to change it.`);
      return;
    }

    setSaving(true);
    try {
      const res = await window.api.percentageRules.create({
        productId: form.productId ? Number(form.productId) : null,
        targetType: form.targetType,
        customerId: form.targetType === 'customer' && form.customerId ? Number(form.customerId) : null,
        customerTier: form.targetType === 'tier' && form.customerTier ? form.customerTier : null,
        percentage: form.percentage === '' ? null : Number(form.percentage),
      });
      if (!res.success) {
        setFormError(plainReason(res.reason));
        return;
      }
      setModalOpen(false);
      toast.success('Margin added');
      loadRules().catch(() => setLoadFailed(true));
    } catch {
      setFormError('Could not add this margin. It may already exist — check the list and try again.');
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback(
    async (rule) => {
      const ok = await confirm({
        title: 'Remove this margin?',
        message: 'Those customers will go back to the next price that applies.',
        confirmLabel: 'Remove',
        destructive: true,
      });
      if (!ok) return;
      try {
        await window.api.percentageRules.delete({ id: rule.id });
        toast.success('Margin removed');
      } catch {
        toast.error("Couldn't remove that margin. Please try again.");
      }
      loadRules().catch(() => setLoadFailed(true));
    },
    [confirm, toast, loadRules]
  );

  const columns = useMemo(() => marginColumns({ onDelete: handleDelete }), [handleDelete]);

  if (user.role !== 'admin') {
    return <RestrictedNotice />;
  }

  return (
    <div style={{ paddingBottom: '48px' }}>
      <MarginsIntro />

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.smd }}>
        <span style={{ ...theme.type.footnote, ...theme.font.numeric, color: theme.colors.labelSecondary }}>
          {loading ? 'Loading…' : `${rules.length} margin${rules.length === 1 ? '' : 's'}`}
        </span>
        <Button icon={Plus} onClick={openModal} disabled={loading || loadFailed} style={{ marginLeft: 'auto' }}>
          {glossary.addMargin}
        </Button>
      </div>

      <Card padding="0" style={{ overflow: 'hidden' }}>
        {loadFailed ? (
          <LoadError message="Special margins couldn't be loaded." onRetry={loadAll} />
        ) : (
          <DataTable columns={columns} rows={rules} loading={loading} emptyState={<NoMargins onAdd={openModal} />} />
        )}
      </Card>

      <AddMarginModal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        onSave={handleAdd}
        saving={saving}
        products={products}
        customers={customers}
        form={form}
        onChange={changeForm}
        errors={errors}
        formError={formError}
      />
    </div>
  );
}
