import React, { useRef } from 'react';
import { Modal, useConfirm } from '../../components/ui';
import BillOverlay from '../../components/billing/BillOverlay';
import StockEntryForm from './StockEntryForm';

// Add Stock / Delete Stock. From the Stock page it's the full multi-product
// sheet; with a `productId` (a product's own profile) it's a small modal about
// that product only. Mount it fresh each time it opens.
export default function StockEntryDialog({ open, mode, productId, productName, onSaved, onClose }) {
  const confirm = useConfirm();
  const dirtyRef = useRef(false);
  const isAdd = mode === 'add';
  const title = isAdd ? 'Add Stock' : 'Delete Stock';

  if (!open) return null;

  async function requestClose() {
    if (dirtyRef.current) {
      const ok = await confirm({ title: 'Discard this?', message: 'The quantities you entered will be lost.', confirmLabel: 'Discard', destructive: true });
      if (!ok) return;
    }
    onClose();
  }

  const form = (
    <StockEntryForm
      mode={mode}
      productId={productId}
      onDirty={(d) => {
        dirtyRef.current = d;
      }}
      onSaved={() => {
        dirtyRef.current = false;
        onSaved?.();
        onClose();
      }}
      onCancel={requestClose}
    />
  );

  if (productId) {
    return (
      <Modal open onClose={requestClose} title={title} subtitle={productName} width={760}>
        <div style={{ padding: '16px 20px 20px' }}>{form}</div>
      </Modal>
    );
  }
  return (
    <BillOverlay
      title={title}
      subtitle={isAdd ? 'Pick the products and how many are coming in.' : 'Pick the products and how many to take out.'}
      onRequestClose={requestClose}
    >
      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>{form}</div>
    </BillOverlay>
  );
}
