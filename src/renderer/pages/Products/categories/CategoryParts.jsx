import React, { memo } from 'react';
import { CornerDownRight, Pencil, Trash2 } from 'lucide-react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Button, Field, FieldError, Icon, IconButton, IconTile, Modal, Select, TextInput } from '../../../components/ui';

const c = theme.colors;

// One row inside the grouped ListSection. `separator` is injected by
// ListSection; children are indented under their parent.
export const CategoryRow = memo(function CategoryRow({ category, isChild, separator, onEdit, onDelete }) {
  const count = category.product_count;
  const inset = isChild ? 58 : 16;
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing.smd,
        minHeight: theme.control.row,
        padding: `4px 8px 4px ${inset}px`,
        boxSizing: 'border-box',
      }}
    >
      {separator && <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: inset, right: 0, height: '1px', backgroundColor: c.separator }} />}
      {isChild ? (
        <Icon icon={CornerDownRight} size={16} style={{ color: c.labelTertiary }} />
      ) : (
        <IconTile {...appIcons.categories} size="md" variant="soft" />
      )}
      <div style={{ flex: 1, minWidth: 0, ...theme.type.body, fontWeight: isChild ? 400 : theme.font.weightMedium, color: c.label }}>{category.name}</div>
      {count != null && (
        <span style={{ ...theme.type.subhead, ...theme.font.numeric, color: c.labelSecondary, whiteSpace: 'nowrap' }}>
          {count} product{count === 1 ? '' : 's'}
        </span>
      )}
      <IconButton icon={Pencil} label={`Edit ${category.name}`} onClick={() => onEdit(category)} />
      <IconButton icon={Trash2} tone="danger" label={`Delete ${category.name}`} onClick={() => onDelete(category)} />
    </div>
  );
});

// Add / Edit sheet. Only top-level categories can be parents (one level).
export function CategoryModal({ form, parents, hasChildren, error, saving, onChange, onSave, onClose }) {
  if (!form) return null;
  return (
    <Modal
      open
      onClose={onClose}
      title={form.id ? 'Edit Category' : 'Add Category'}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Pens" aria-invalid={!!error} />
        </Field>
        <Field label="Parent category" hint={hasChildren ? 'This category has its own sub-categories, so it stays at the top.' : 'Optional. Put it inside another category.'} style={{ marginBottom: 0 }}>
          <Select value={form.parentId} disabled={hasChildren} onChange={(e) => onChange({ ...form, parentId: e.target.value })}>
            <option value="">None</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        {error && (
          <div role="alert">
            <FieldError>{error}</FieldError>
          </div>
        )}
      </form>
    </Modal>
  );
}
