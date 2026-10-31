import React, { useId } from 'react';
import { Download, FileText, FileUp, Pencil, Star, Trash2 } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Badge, Banner, Button, Card, EmptyState, Field, IconTile, Modal, NumberInput, Skeleton, Spinner, TextInput, Toggle } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';

const c = theme.colors;

// Local filesystem paths need the file:// scheme (and a third slash on
// Windows) to load as a src.
function toFileUrl(p) {
  if (!p) return null;
  const normalized = p.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

export const letterheadGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: theme.spacing.md };

// Dashed "drop zone" look; clicking opens the existing file picker.

export function DownloadTemplateButton({ onClick, busy }) {
  const { hovered, handlers } = useInteraction(busy);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      {...handlers}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        border: `1px solid ${hovered ? c.accent : c.separatorStrong}`,
        borderRadius: theme.radius.md,
        backgroundColor: hovered ? c.surfaceAlt : c.surface,
        color: hovered ? c.accent : c.label,
        fontFamily: theme.font.family,
        ...theme.type.subheadline,
        cursor: busy ? 'progress' : 'pointer',
        transition: `all ${theme.motion.fast} ease`,
      }}
    >
      {busy ? <Spinner size={16} /> : <Download size={16} aria-hidden="true" />}
      {busy ? 'Preparing template…' : 'Download Template (A4 PDF)'}
    </button>
  );
}

export function UploadButton({ onClick, busy }) {
  const { hovered, handlers } = useInteraction(busy);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      {...handlers}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        width: '100%',
        minHeight: '72px',
        padding: theme.spacing.md,
        border: `2px dashed ${hovered ? c.accent : c.separatorStrong}`,
        borderRadius: theme.radius.lg,
        backgroundColor: hovered ? c.accentTint : c.surface,
        color: c.accent,
        fontFamily: theme.font.family,
        ...theme.type.headline,
        cursor: busy ? 'progress' : 'pointer',
        transition: `background-color ${theme.motion.fast} ease`,
      }}
    >
      {busy ? <Spinner size={18} /> : <FileUp size={20} aria-hidden="true" />}
      {busy ? 'Opening…' : glossary.uploadLetterhead}
    </button>
  );
}

export function LetterheadCard({ letterhead, onEdit, onSetDefault, onDelete, busy }) {
  const isDefault = !!letterhead.is_default;
  return (
    <Card padding="0" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceAlt, borderBottom: `1px solid ${c.separator}` }}>
        <IconTile icon={FileText} color="blue" size="xl" variant="soft" />
      </div>
      <div style={{ padding: theme.spacing.md, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <span style={{ ...theme.type.headline, color: c.label, overflowWrap: 'anywhere' }}>{letterhead.name}</span>
          {isDefault && (
            <Badge tone="green" dot>
              Default
            </Badge>
          )}
        </div>
        <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, marginTop: '4px' }}>
          Space kept clear: {letterhead.content_margin_top_mm} mm top · {letterhead.content_margin_bottom_mm} mm bottom
        </div>
      </div>
      <div style={{ display: 'flex', gap: theme.spacing.xs, padding: `${theme.spacing.sm} ${theme.spacing.smd}`, borderTop: `1px solid ${c.separator}`, flexWrap: 'wrap' }}>
        <Button size="sm" variant="plain" icon={Pencil} onClick={onEdit} disabled={busy}>
          Edit
        </Button>
        {!isDefault && (
          <Button size="sm" variant="plain" icon={Star} onClick={onSetDefault} disabled={busy}>
            Set as Default
          </Button>
        )}
        <Button size="sm" variant="plain" icon={Trash2} onClick={onDelete} disabled={busy} style={{ marginLeft: 'auto', color: c.redText }}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

export function LetterheadSkeletons() {
  return (
    <div style={letterheadGrid}>
      {[0, 1, 2].map((i) => (
        <Card key={i}>
          <Skeleton height="90px" style={{ marginBottom: theme.spacing.md }} />
          <Skeleton lines={2} />
        </Card>
      ))}
    </div>
  );
}

export function NoLetterheads() {
  return (
    <Card>
      <EmptyState icon={FileText} color="blue" title="No letterheads yet" message="Upload a PDF to use as the header on your A4 invoices." />
    </Card>
  );
}

const onlyNumber = (fn) => (e) => {
  if (/^\d*\.?\d*$/.test(e.target.value)) fn(e.target.value);
};

// Add / edit sheet. All values and handlers come from Letterheads.jsx.
export function LetterheadFormModal({ isNew, form, onField, previewPath, onPickPdf, picking, error, saving, onSave, onClose }) {
  const defaultId = useId();
  return (
    <Modal
      open
      onClose={saving ? undefined : onClose}
      title={isNew ? 'Add Letterhead' : 'Edit Letterhead'}
      subtitle="Every A4 invoice is printed on a fresh copy of this page."
      width={640}
      footer={
        <>
          <Button variant="plain" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving}>
            Save letterhead
          </Button>
        </>
      }
    >
      <Field label="Name" required>
        <TextInput value={form.name} onChange={(e) => onField('name', e.target.value)} autoFocus autoComplete="off" />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.sm }}>
        <span style={{ ...theme.type.subhead, fontWeight: theme.font.weightMedium, color: c.label, flex: 1 }}>PDF page (A4)</span>
        <Button size="sm" variant="tinted" icon={FileUp} onClick={onPickPdf} loading={picking}>
          {previewPath ? 'Choose a different PDF' : 'Choose PDF file'}
        </Button>
      </div>
      {previewPath ? (
        <embed
          src={toFileUrl(previewPath)}
          type="application/pdf"
          style={{ display: 'block', width: '100%', height: '320px', border: `1px solid ${c.separator}`, borderRadius: theme.radius.md }}
        />
      ) : (
        <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>No PDF chosen yet.</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', columnGap: theme.spacing.md, marginTop: theme.spacing.md }}>
        <Field label="Space at the top (mm)" hint="Keeps the invoice clear of your logo and header art.">
          <NumberInput value={String(form.marginTopMm)} onChange={onlyNumber((v) => onField('marginTopMm', v))} />
        </Field>
        <Field label="Space at the bottom (mm)" hint="Keeps the invoice clear of any footer art.">
          <NumberInput value={String(form.marginBottomMm)} onChange={onlyNumber((v) => onField('marginBottomMm', v))} />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
        <label htmlFor={defaultId} style={{ flex: 1, cursor: 'pointer' }}>
          <div style={{ ...theme.type.body, color: c.label }}>Use as the default letterhead</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>Used for A4 invoices when the customer doesn’t have their own.</div>
        </label>
        <Toggle id={defaultId} checked={form.isDefault} onChange={(v) => onField('isDefault', v)} label="Use as the default letterhead" />
      </div>

      <Banner>{error}</Banner>
    </Modal>
  );
}
