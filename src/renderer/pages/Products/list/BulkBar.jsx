import React, { useState } from 'react';
import { FolderInput, EyeOff } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, Field, Modal, Select } from '../../../components/ui';

const c = theme.colors;

// Floating selection bar, centered near the bottom of the list (clear of
// the Dev Panel corner). Only the bulk actions the list already had.
export function BulkBar({ count, categories, onMoveToCategory, onDeactivate, onClear }) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  async function applyMove() {
    if (!categoryId) return;
    setBusy(true);
    await onMoveToCategory(categoryId);
    setBusy(false);
    setMoveOpen(false);
    setCategoryId('');
  }

  return (
    <>
      <div style={{ position: 'sticky', bottom: theme.spacing.md, display: 'flex', justifyContent: 'center', pointerEvents: 'none', marginTop: theme.spacing.md, zIndex: 5 }}>
        <div
          role="toolbar"
          aria-label="Selected products"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: '6px 6px 6px 18px',
            backgroundColor: c.surface,
            borderRadius: theme.radius.pill,
            boxShadow: theme.shadow.popover,
            animation: `slide-down ${theme.motion.base} ${theme.motion.easing}`,
          }}
        >
          <span style={{ ...theme.type.body, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, marginRight: theme.spacing.xs }}>{count} selected</span>
          <Button variant="tinted" size="sm" icon={FolderInput} onClick={() => setMoveOpen(true)}>
            Move to category…
          </Button>
          <Button variant="danger" size="sm" icon={EyeOff} onClick={onDeactivate}>
            Deactivate
          </Button>
          <Button variant="plain" size="sm" onClick={onClear}>
            Clear
          </Button>
        </div>
      </div>

      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move to category"
        subtitle={`${count} product${count === 1 ? '' : 's'} will move.`}
        width={400}
        footer={
          <>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyMove} disabled={!categoryId} loading={busy}>
              Move
            </Button>
          </>
        }
      >
        <Field label="Category">
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Choose a category…</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.parent_name ? `${cat.parent_name} › ${cat.name}` : cat.name}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>
    </>
  );
}
