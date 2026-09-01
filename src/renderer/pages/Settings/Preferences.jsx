import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, TextArea, Button, Banner, HelperText } from '../../components/ui';

export default function Preferences() {
  const { user } = useAuth();

  const [receiptFooterText, setReceiptFooterText] = useState('');
  const [defaultLowStockAlert, setDefaultLowStockAlert] = useState('');
  const [defaultCashierDiscountCap, setDefaultCashierDiscountCap] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.settings.getAll().then((s) => {
      setReceiptFooterText(s.receipt_footer_text || '');
      setDefaultLowStockAlert(s.default_low_stock_alert ?? '');
      setDefaultCashierDiscountCap(s.default_cashier_discount_cap ?? '');
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setError('');
    setSaved(false);
    setSaving(true);
    const res = await window.api.settings.setMany({
      receipt_footer_text: receiptFooterText.trim(),
      default_low_stock_alert: defaultLowStockAlert === '' ? '' : Number(defaultLowStockAlert) || 0,
      default_cashier_discount_cap: defaultCashierDiscountCap === '' ? '' : Number(defaultCashierDiscountCap) || 0,
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save preferences.');
      return;
    }
    setSaved(true);
  }

  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  if (!loaded) return <Card>Loading…</Card>;

  return (
    <div>
      <PageHeader title="App Preferences" />
      <Card style={{ maxWidth: '480px' }}>
        <Label>Receipt Footer Text</Label>
        <TextArea value={receiptFooterText} onChange={(e) => setReceiptFooterText(e.target.value)} placeholder="Thank you for shopping with us!" />
        <HelperText>Printed at the bottom of every thermal receipt.</HelperText>

        <Label>Default Low Stock Alert</Label>
        <TextInput type="number" value={defaultLowStockAlert} onChange={(e) => setDefaultLowStockAlert(e.target.value)} placeholder="0" />
        <HelperText>Prefills the Min Stock Alert field when creating a new product. Doesn't change existing products.</HelperText>

        <Label>Default Cashier Discount Cap (%)</Label>
        <TextInput type="number" value={defaultCashierDiscountCap} onChange={(e) => setDefaultCashierDiscountCap(e.target.value)} placeholder="0" />
        <HelperText>Used at checkout for any cashier who doesn't have an individual discount cap set under Users &amp; Permissions.</HelperText>

        <Banner>{error}</Banner>
        {saved && !error && <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>Saved.</div>}

        <Button onClick={handleSave} disabled={saving} style={{ marginTop: theme.spacing.lg }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Card>
    </div>
  );
}
