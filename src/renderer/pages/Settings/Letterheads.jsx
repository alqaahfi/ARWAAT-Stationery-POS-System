import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Banner, useConfirm, useToast } from '../../components/ui';
import { LoadError, RestrictedNotice } from '../Parties/PartyParts';
import { PageIntro, settingsColumn } from './parts/SettingsParts';
import {
  LetterheadCard,
  LetterheadFormModal,
  LetterheadSkeletons,
  NoLetterheads,
  DownloadTemplateButton,
  UploadButton,
  letterheadGrid,
} from './parts/LetterheadParts';

const DEFAULT_MARGIN_TOP_MM = 40;
const DEFAULT_MARGIN_BOTTOM_MM = 25;

// "C:\...\letterheads\1712345678_Shop Header.pdf" -> "Shop Header"
function nameFromPath(p = '') {
  const base = p.split(/[\\/]/).pop() || '';
  return base.replace(/^\d+_/, '').replace(/\.pdf$/i, '');
}

// A letterhead is a PDF page the admin designs and uploads themselves (their
// own pre-printed A4 template, logo, borders, whatever they want) — every
// A4 sale invoice is stamped onto a fresh copy of that exact page at print
// time (see pdfInvoiceMerge.js). Margin Top/Bottom control how far from the
// page's edges that stamped content starts/stops, so it doesn't collide with
// whatever artwork already occupies those areas on the template.
export default function Letterheads() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [letterheads, setLetterheads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingId, setEditingId] = useState(null); // null | 'new' | <id>
  const [form, setForm] = useState(null);
  const [existingPdfPath, setExistingPdfPath] = useState(null);
  const [pickedPdfPath, setPickedPdfPath] = useState(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [downloadingWord, setDownloadingWord] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const rows = await window.api.letterheads.list();
      setLetterheads(rows || []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function pickPdf() {
    setPicking(true);
    try {
      const res = await window.api.letterheads.pickPdf();
      return res.canceled ? null : res.pdfTemplatePath;
    } finally {
      setPicking(false);
    }
  }

  // Upload: pick the file first, then fill in the details.
  async function handleUpload() {
    setListError('');
    let path;
    try {
      path = await pickPdf();
    } catch {
      setListError('Could not open that PDF. Please try again.');
      return;
    }
    if (!path) return;
    setEditingId('new');
    setForm({
      name: nameFromPath(path),
      // The very first letterhead is always the default (the backend forces it too).
      isDefault: letterheads.length === 0,
      marginTopMm: DEFAULT_MARGIN_TOP_MM,
      marginBottomMm: DEFAULT_MARGIN_BOTTOM_MM,
    });
    setExistingPdfPath(null);
    setPickedPdfPath(path);
    setError('');
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      isDefault: !!row.is_default,
      marginTopMm: row.content_margin_top_mm ?? DEFAULT_MARGIN_TOP_MM,
      marginBottomMm: row.content_margin_bottom_mm ?? DEFAULT_MARGIN_BOTTOM_MM,
    });
    setExistingPdfPath(row.pdf_template_path);
    setPickedPdfPath(null);
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(null);
    setError('');
  }

  async function handleChangePdf() {
    try {
      const path = await pickPdf();
      if (path) setPickedPdfPath(path);
    } catch {
      setError('Could not open that PDF. Please try again.');
    }
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim()) return setError('Name is required.');

    const payload = {
      name: form.name.trim(),
      pdfTemplatePath: pickedPdfPath,
      contentMarginTopMm: Number(form.marginTopMm) || DEFAULT_MARGIN_TOP_MM,
      contentMarginBottomMm: Number(form.marginBottomMm) || DEFAULT_MARGIN_BOTTOM_MM,
      isDefault: form.isDefault,
    };

    setSaving(true);
    try {
      const res =
        editingId === 'new'
          ? await window.api.letterheads.create(payload)
          : await window.api.letterheads.update({ id: editingId, ...payload });
      if (!res.success) {
        setError(res.reason || 'Could not save letterhead.');
        return;
      }
      toast.success('Letterhead saved');
      cancelEdit();
      load();
    } catch {
      setError('Could not save letterhead. Please try again.');
    } finally {
      setSaving(false);
    }
  }


  async function handleDownloadWordTemplate() {
    setDownloadingWord(true);
    try {
      const res = await window.api.letterheads.downloadWordTemplate();
      if (res && res.success) toast.success('Word template saved');
      else if (res && res.reason) toast.error(res.reason);
    } catch {
      toast.error('Could not download template.');
    } finally {
      setDownloadingWord(false);
    }
  }

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await window.api.letterheads.downloadTemplate();
      if (res && res.success) {
        toast.success('Letterhead design template saved');
      } else if (res && res.reason) {
        toast.error(res.reason);
      }
    } catch {
      toast.error('Could not download template.');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  // Same update call the edit sheet makes, with is_default switched on.
  async function handleSetDefault(l) {
    setListError('');
    setBusyId(l.id);
    try {
      const res = await window.api.letterheads.update({
        id: l.id,
        name: l.name,
        pdfTemplatePath: null,
        contentMarginTopMm: l.content_margin_top_mm ?? DEFAULT_MARGIN_TOP_MM,
        contentMarginBottomMm: l.content_margin_bottom_mm ?? DEFAULT_MARGIN_BOTTOM_MM,
        isDefault: true,
      });
      if (!res.success) setListError(res.reason || 'Could not change the default letterhead.');
      else toast.success(`${l.name} is now the default`);
      load();
    } catch {
      setListError('Could not change the default letterhead.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(l) {
    setListError('');
    const ok = await confirm({
      title: 'Delete this letterhead?',
      message: 'Invoices using it will fall back to the shop default.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    setBusyId(l.id);
    try {
      const res = await window.api.letterheads.delete({ id: l.id });
      if (!res.success) {
        setListError(res.reason || 'Could not delete letterhead.');
        return;
      }
      toast.success('Letterhead deleted');
      if (editingId === l.id) cancelEdit();
      load();
    } catch {
      setListError('Could not delete letterhead.');
    } finally {
      setBusyId(null);
    }
  }

  // Hard role gate — all hooks above run unconditionally every render.
  if (user.role !== 'admin') return <RestrictedNotice />;

  let list;
  if (loading) list = <LetterheadSkeletons />;
  else if (loadFailed) list = <LoadError message="Letterheads couldn't be loaded." onRetry={load} />;
  else if (!letterheads.length) list = <NoLetterheads />;
  else
    list = (
      <div style={letterheadGrid}>
        {letterheads.map((l) => (
          <LetterheadCard
            key={l.id}
            letterhead={l}
            busy={busyId === l.id}
            onEdit={() => startEdit(l)}
            onSetDefault={() => handleSetDefault(l)}
            onDelete={() => handleDelete(l)}
          />
        ))}
      </div>
    );

  return (
    <div style={{ ...settingsColumn, maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: '240px' }}>
          <PageIntro>PDF pages your A4 invoices are printed on — your own logo, address and borders.</PageIntro>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <DownloadTemplateButton onClick={handleDownloadWordTemplate} busy={downloadingWord} label="Word template (.docx)" />
          <DownloadTemplateButton onClick={handleDownloadTemplate} busy={downloadingTemplate} label="PDF guide" />
        </div>
      </div>
      <UploadButton onClick={handleUpload} busy={picking && editingId === null} />
      <Banner style={{ marginTop: 0 }}>{listError}</Banner>
      {list}

      {editingId !== null && form && (
        <LetterheadFormModal
          isNew={editingId === 'new'}
          form={form}
          onField={(key, value) => setForm((f) => ({ ...f, [key]: value }))}
          previewPath={pickedPdfPath || existingPdfPath}
          onPickPdf={handleChangePdf}
          picking={picking}
          error={error}
          saving={saving}
          onSave={handleSave}
          onClose={cancelEdit}
        />
      )}
    </div>
  );
}
