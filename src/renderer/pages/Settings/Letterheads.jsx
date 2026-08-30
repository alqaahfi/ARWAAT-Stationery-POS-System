import React, { useEffect, useState } from 'react';
import theme from '../../config/theme';
import { Card, PageHeader, Label, TextInput, Checkbox, Button, Banner, tableStyles, Tr } from '../../components/ui';

// Local filesystem paths need the file:// scheme (and a Windows drive path
// needs a third slash) to render as an <img src>.
function toFileUrl(p) {
  if (!p) return null;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

// One page: the letterhead list and the add/edit form live side by side —
// no separate route for "Add Letterhead", no modal.
export default function Letterheads() {
  const [letterheads, setLetterheads] = useState([]);
  const [editingId, setEditingId] = useState(null); // null | 'new' | <id>
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [existingImagePath, setExistingImagePath] = useState(null);
  const [pickedImagePath, setPickedImagePath] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
    setIsDefault(false);
    setExistingImagePath(null);
    setPickedImagePath(null);
    setError('');
  }

  function startEdit(row) {
    setEditingId(row.id);
    setName(row.name);
    setIsDefault(!!row.is_default);
    setExistingImagePath(row.image_path);
    setPickedImagePath(null);
    setError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setError('');
  }

  async function handlePickImage() {
    const res = await window.api.letterheads.pickImage();
    if (res.canceled) return;
    setPickedImagePath(res.imagePath);
  }

  async function handleSave() {
    setError('');
    if (!name.trim()) return setError('Name is required.');

    setSaving(true);
    const res =
      editingId === 'new'
        ? await window.api.letterheads.create({ name: name.trim(), imagePath: pickedImagePath, isDefault })
        : await window.api.letterheads.update({ id: editingId, name: name.trim(), imagePath: pickedImagePath, isDefault });
    setSaving(false);

    if (!res.success) {
      setError(res.reason || 'Could not save letterhead.');
      return;
    }
    cancelEdit();
    load();
  }

  const previewPath = pickedImagePath || existingImagePath;

  return (
    <div>
      <PageHeader title="Letterheads" actions={editingId === null && <Button onClick={startNew}>+ Add Letterhead</Button>} />

      {editingId !== null && (
        <Card style={{ marginBottom: theme.spacing.lg, maxWidth: '560px' }}>
          <h4 style={{ margin: 0, color: theme.colors.textPrimary }}>{editingId === 'new' ? 'Add Letterhead' : 'Edit Letterhead'}</h4>

          <Label>Name</Label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <Label>Image</Label>
          <div style={styles.imageRow}>
            {previewPath ? (
              <img src={toFileUrl(previewPath)} alt="" style={styles.preview} />
            ) : (
              <div style={styles.previewPlaceholder}>No image chosen</div>
            )}
            <Button variant="secondary" onClick={handlePickImage}>
              Choose Image
            </Button>
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

      <Card style={{ padding: 0 }}>
        <div style={tableStyles.scroll}>
          <table style={tableStyles.table}>
            <thead>
              <tr>
                <th style={tableStyles.th}>Preview</th>
                <th style={tableStyles.th}>Name</th>
                <th style={tableStyles.th}></th>
                <th style={tableStyles.th}></th>
              </tr>
            </thead>
            <tbody>
              {letterheads.map((l) => (
                <Tr key={l.id}>
                  <td style={tableStyles.td}>
                    {l.image_path ? <img src={toFileUrl(l.image_path)} alt="" style={styles.thumb} /> : '—'}
                  </td>
                  <td style={tableStyles.td}>{l.name}</td>
                  <td style={tableStyles.td}>{!!l.is_default && <span style={styles.defaultBadge}>Default</span>}</td>
                  <td style={tableStyles.td}>
                    <Button variant="ghost" style={{ padding: '5px 10px', fontSize: theme.font.sizeXs }} onClick={() => startEdit(l)}>
                      Edit
                    </Button>
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
  imageRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginTop: '4px' },
  preview: { width: '160px', height: '90px', objectFit: 'cover', borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}` },
  previewPlaceholder: {
    width: '160px',
    height: '90px',
    borderRadius: theme.radius.sm,
    border: `1px dashed ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.font.sizeXs,
    textAlign: 'center',
  },
  thumb: { width: '64px', height: '36px', objectFit: 'cover', borderRadius: theme.radius.sm, border: `1px solid ${theme.colors.border}` },
  defaultBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.successBackground,
    color: theme.colors.success,
    fontSize: theme.font.sizeXs,
  },
};
