import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Button, Banner, HelperText } from '../../components/ui';

// Feeds both the thermal receipt header and the A4 invoice header (used as
// the fallback when a wholesale customer has no letterhead assigned).
export default function ShopInfo() {
  const { user } = useAuth();

  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [currencySymbol, setCurrencySymbol] = useState('Rs.');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    window.api.settings.getAll().then((s) => {
      setShopName(s.shop_name || '');
      setShopAddress(s.shop_address || '');
      setShopPhone(s.shop_phone || '');
      setCurrencySymbol(s.currency_symbol || 'Rs.');
      setLoaded(true);
    });
  }, []);

  async function handleSave() {
    setError('');
    setSaved(false);
    if (!shopName.trim()) return setError('Shop name is required.');

    setSaving(true);
    const res = await window.api.settings.setMany({
      shop_name: shopName.trim(),
      shop_address: shopAddress.trim(),
      shop_phone: shopPhone.trim(),
      currency_symbol: currencySymbol.trim() || 'Rs.',
    });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save shop info.');
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
      <PageHeader title="Shop Info" />
      <Card style={{ maxWidth: '480px' }}>
        <Label>Shop Name</Label>
        <TextInput value={shopName} onChange={(e) => setShopName(e.target.value)} autoFocus />

        <Label>Address</Label>
        <TextInput value={shopAddress} onChange={(e) => setShopAddress(e.target.value)} />

        <Label>Phone</Label>
        <TextInput value={shopPhone} onChange={(e) => setShopPhone(e.target.value)} />

        <Label>Currency Symbol</Label>
        <TextInput value={currencySymbol} onChange={(e) => setCurrencySymbol(e.target.value)} style={{ maxWidth: '120px' }} />
        <HelperText>Used on receipts and invoices, e.g. "Rs." or "$".</HelperText>

        <Banner>{error}</Banner>
        {saved && !error && <div style={{ color: theme.colors.success, fontSize: theme.font.sizeSm, marginTop: theme.spacing.sm }}>Saved.</div>}

        <Button onClick={handleSave} disabled={saving} style={{ marginTop: theme.spacing.lg }}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </Card>
    </div>
  );
}
