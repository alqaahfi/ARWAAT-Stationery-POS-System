import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Checkbox, Button, Banner, HelperText, tableStyles, Tr } from '../../components/ui';

// Local filesystem paths need the file:// scheme (and a third slash on
// Windows) to load as a src.
function toFileUrl(p) {
  if (!p) return null;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

const DEFAULT_MARGIN_TOP_MM = 40;
const DEFAULT_MARGIN_BOTTOM_MM = 25;

// One page: the letterhead list and the add/edit form live side by side —
// no separate route for "Add Letterhead", no modal.
//
// A letterhead is a PDF page the admin designs and uploads themselves (their
// own pre-printed A4 template, logo, borders, whatever they want) — every
// A4 sale invoice is stamped onto a fresh copy of that exact page at print
// time (see pdfInvoiceMerge.js). Margin Top/Bottom control how far from the
// page's edges that stamped content starts/stops, so it doesn't collide with
// whatever artwork already occupies those areas on the template.
export default function Letterheads() {
  const { user } = useAuth();
  const [letterheads, setLetterheads] = useState([]);
  const [editingId, setEditingId] = useState(null); // null | 'new' | <id>
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [marginTopMm, setMarginTopMm] = useState(DEFAULT_MARGIN_TOP_MM);
  const [marginBottomMm, setMarginBottomMm] = useState(DEFAULT_MARGIN_BOTTOM_MM);
  const [existingPdfPath, setExistingPdfPath] = useState(null);
  const [pickedPdfPath, setPickedPdfPath] = useState(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const rows = await window.api.letterheads.list();
    setLetterheads(rows);
  }

  function startNew() {
    setEditingId('new');
    setName('');
    // Pre-checked for the very first letterhead — nothing else it could
    // mean, and the backend forces it true anyway; reflecting that here just
    // keeps the checkbox honest instead of showing unchecked next to what
    // will actually be saved as the default.
    setIsDefault(letterheads.length === 0);
    setMarginTopMm(DEFAULT_MARGIN_TOP_MM);
    setMarginBottomMm(DEFAULT_MARGIN_BOTTOM_MM);
    setExistingPdfPath(null);
    setPickedPdfPath(null);
    setError('');
  }

  function startEdit(row) {
    setEditingId(row.id);
    setName(row.name);
    setIsDefault(!!row.is_default);
    setMarginTopMm(row.content_margin_top_mm ?? DEFAULT_MARGIN_TOP_MM);
    setMarginBottomMm(row.content_margin_bottom_mm ?? DEFAULT_MARGIN_BOTTOM_MM);
    setExistingPdfPath(row.pdf_template_path);
    setPickedPdfPath(null);
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setError('');
  }

  async function handlePickPdf() {
    setPicking(true);
    const res = await window.api.letterheads.pickPdf();
    setPicking(false);
    if (res.canceled) return;
    setPickedPdfPath(res.pdfTemplatePath);
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) return setError('Name is required.');

    const payload = {
      name: name.trim(),
      pdfTemplatePath: pickedPdfPath,
      contentMarginTopMm: Number(marginTopMm) || DEFAULT_MARGIN_TOP_MM,
      contentMarginBottomMm: Number(marginBottomMm) || DEFAULT_MARGIN_BOTTOM_MM,
      isDefault,
    };

    setSaving(true);
    const res =
      editingId === 'new'
        ? await window.api.letterheads.create(payload)
        : await window.api.letterheads.update({ id: editingId, ...payload });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save letterhead.');
      return;
    }
    cancelEdit();
    load();
  }

  async function handleDelete(l) {
    setListError('');
    const confirmed = window.confirm(`Delete "${l.name}"? This cannot be undone.`);
    if (!confirmed) return;

    const res = await window.api.letterheads.delete({ id: l.id });
    if (!res.success) {
      setListError(res.reason || 'Could not delete letterhead.');
      return;
    }
    if (editingId === l.id) cancelEdit();
    load();
  }

  const previewPath = pickedPdfPath || existingPdfPath;

  // Hard role gate, same as the rest of Settings — all hooks above run
  // unconditionally every render; this check only decides the returned JSX.
  if (user.role !== 'admin') {
    return (
      <Card style={{ padding: '48px', textAlign: 'center' }}>
        <h3 style={{ margin: 0, color: theme.colors.textPrimary }}>This section is restricted to Admin accounts</h3>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Letterheads" actions={editingId === null && <Button onClick={startNew}>+ Add Letterhead</Button>} />

      {editingId !== null && (
        <Card style={{ marginBottom: theme.spacing.lg, maxWidth: '640px' }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>{editingId === 'new' ? 'Add Letterhead' : 'Edit Letterhead'}</h4>

          <Label>Name</Label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <Label>PDF Template (A4 page)</Label>
          <div>
            <Button variant="secondary" onClick={handlePickPdf} disabled={picking}>
              {picking ? 'Choosing…' : previewPath ? 'Choose a Different PDF' : 'Choose PDF File'}
            </Button>
            <HelperText>Every A4 invoice is stamped onto a fresh copy of this exact page at print time.</HelperText>
          </div>
          {previewPath && (
            <embed src={toFileUrl(previewPath)} type="application/pdf" style={styles.pdfPreview} />
          )}

          <div style={styles.marginRow}>
            <div style={{ flex: 1 }}>
              <Label>Content Top Margin (mm)</Label>
              <TextInput type="number" min="0" value={marginTopMm} onChange={(e) => setMarginTopMm(e.target.value)} />
              <HelperText>How far down the invoice content starts — clear whatever artwork sits at the top.</HelperText>
            </div>
            <div style={{ flex: 1 }}>
              <Label>Content Bottom Margin (mm)</Label>
              <TextInput type="number" min="0" value={marginBottomMm} onChange={(e) => setMarginBottomMm(e.target.value)} />
              <HelperText>How much space to leave clear at the bottom of the page.</HelperText>
            </div>
          </div>

          <Checkbox label="Set as default" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />

          <Banner>{error}</Banner>

          <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.lg }}>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" onClick={cancelEdit}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Banner>{listError}</Banner>

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}>Margins (top / bottom)</th>
                <th style={tableStyles.th}></th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {letterheads.map((l) => (
                <Tr key={l.id}>
                  <td style={tableStyles.td}>{l.name}</td>
                  <td style={{ ...tableStyles.td, color: theme.colors.textSecondary }}>
                    {l.content_margin_top_mm}mm / {l.content_margin_bottom_mm}mm
                  </td>
                  <td style={tableStyles.td}>{!!l.is_default && <span style={styles.defaultBadge}>Default</span>}</td>
                  <td style={tableStyles.td}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => startEdit(l)}>
                        Edit
                      </Button>
                      <Button variant="danger" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => handleDelete(l)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </Tr>
              ))}
              {letterheads.length === 0 && (
                <tr>
                  <td colSpan={4} style={tableStyles.emptyState}>
                    No letterheads yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const styles = {
  pdfPreview: {
    display: 'block',
    width: '100%',
    height: '360px',
    marginTop: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.sm,
  },
  marginRow: { display: 'flex', gap: theme.spacing.md },
  defaultBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.successBackground,
    color: theme.colors.success,
    fontSize: theme.font.sizeXs,
  },
};
