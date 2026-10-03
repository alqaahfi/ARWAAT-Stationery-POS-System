import React, { useCallback, useEffect, useState } from 'react';
import theme from '../../config/theme';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui';
import { StickyActions } from '../Products/form/StickyActions';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { SettingsSkeleton, pageWrap } from './parts/SettingsParts';
import { ReceiptForm, ReceiptPreview } from './parts/ReceiptParts';

// What actually prints on a receipt is unrelated to the app's own UI
// branding (see appInfo.js) — this is the shop's real identity, free-text so
// the admin controls exactly what shows up, in whatever format they want.
// Feeds thermalReceipt.js / ThermalContent.jsx's header+footer directly, and
// printA4Invoice.js's plain-text fallback header (no letterhead assigned)
// plus every A4 invoice's footer regardless of letterhead.
export default function ReceiptContent() {
  const { user } = useAuth();
  const toast = useToast();

  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [paperWidth, setPaperWidth] = useState('58mm');
  const [initial, setInitial] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadFailed(false);
    window.api.settings
      .getAll()
      .then((s) => {
        const header = s.receipt_header_text || '';
        const footer = s.receipt_footer_text || '';
        setHeaderText(header);
        setFooterText(footer);
        setPaperWidth(s.thermal_paper_width || '58mm');
        setInitial({ header, footer });
      })
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await window.api.settings.setMany({
        receipt_header_text: headerText,
        receipt_footer_text: footerText,
      });
      if (!res.success) {
        toast.error(res.reason || 'Could not save receipt content.');
        return;
      }
      setInitial({ header: headerText, footer: footerText });
      toast.success('Receipt header & footer saved');
    } catch {
      toast.error('Could not save receipt content. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function undo() {
    setHeaderText(initial.header);
    setFooterText(initial.footer);
  }

  if (user.role !== 'admin') return <RestrictedNotice />;
  if (loadFailed) return <LoadError message="Receipt settings couldn't be loaded." onRetry={load} />;
  if (!initial) return <SettingsSkeleton />;

  const dirty = headerText !== initial.header || footerText !== initial.footer;

  return (
    <div style={pageWrap}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md, alignItems: 'flex-start', paddingBottom: '48px' }}>
        <ReceiptForm headerText={headerText} onHeaderText={setHeaderText} footerText={footerText} onFooterText={setFooterText} />
        <ReceiptPreview headerText={headerText} footerText={footerText} paperWidth={paperWidth} />
      </div>
      <StickyActions onCancel={undo} cancelLabel="Undo changes" onSave={handleSave} saving={saving} saveLabel="Save" saveDisabled={!dirty} />
    </div>
  );
}
