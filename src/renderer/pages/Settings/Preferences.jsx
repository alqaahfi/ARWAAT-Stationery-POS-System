import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { setCurrencySymbol } from '../../utils/format';
import { AUTO_LOCK_DEFAULT_MINUTES, AUTO_LOCK_EVENT } from '../../layout/LockScreen';
import { StickyActions } from '../Products/form/StickyActions';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { SettingsSkeleton, pageWrap, settingsColumn } from './parts/SettingsParts';
import { PreferenceSections } from './parts/PreferencesParts';

function fromSettings(s) {
  return {
    currencySymbol: s.currency_symbol || 'Rs.',
    defaultLowStockAlert: String(s.default_low_stock_alert ?? ''),
    defaultCashierDiscountCap: String(s.default_cashier_discount_cap ?? ''),
    autoLockMinutes: String(s.auto_lock_minutes ?? AUTO_LOCK_DEFAULT_MINUTES),
  };
}

export default function Preferences() {
  const { user } = useAuth();
  const toast = useToast();

  const [values, setValues] = useState(null);
  const [initial, setInitial] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    window.api.settings
      .getAll()
      .then((s) => {
        const v = fromSettings(s || {});
        setValues(v);
        setInitial(v);
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function handleChange(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await window.api.settings.setMany({
        currency_symbol: values.currencySymbol.trim() || 'Rs.',
        default_low_stock_alert: values.defaultLowStockAlert === '' ? '' : Number(values.defaultLowStockAlert) || 0,
        default_cashier_discount_cap: values.defaultCashierDiscountCap === '' ? '' : Number(values.defaultCashierDiscountCap) || 0,
        auto_lock_minutes: values.autoLockMinutes === '' ? AUTO_LOCK_DEFAULT_MINUTES : Math.floor(Number(values.autoLockMinutes) || 0),
      });
      if (!res.success) {
        toast.error(res.reason || 'Could not save preferences.');
        return;
      }
      setCurrencySymbol(values.currencySymbol);
      window.dispatchEvent(new Event(AUTO_LOCK_EVENT));
      setInitial(values);
      toast.success('Preferences saved');
    } catch {
      toast.error('Could not save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (loadFailed) return <LoadError message="Preferences couldn't be loaded." onRetry={load} />;
  if (!values) return <SettingsSkeleton />;

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <div style={pageWrap}>
      <div style={settingsColumn}>
        <PreferenceSections values={values} onChange={handleChange} />
      </div>
      <StickyActions
        onCancel={() => setValues(initial)}
        cancelLabel="Undo changes"
        onSave={handleSave}
        saving={saving}
        saveLabel="Save preferences"
        saveDisabled={!dirty}
      />
    </div>
  );
}
