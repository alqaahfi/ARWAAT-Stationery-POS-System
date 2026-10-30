import React, { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import theme from '../../config/theme';
import { Banner, Button, Modal, Spinner, useToast } from '../ui';

const c = theme.colors;

function base64ToBlobUrl(base64) {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

// Every sale receipt goes through here instead of straight to the printer.
// It shows the finished document (A4 invoice or thermal roll receipt, both
// rendered by the main process as a PDF) and offers Print / Save / Cancel.
//
// Cancel only closes this window. The sale is already saved by the time this
// opens, so nothing here ever voids, deletes or edits it.
//   printType: 'wholesale-a4' | 'retail-thermal'
//   onPrinted(result): called after a successful physical print
export default function PrintPreviewModal({ saleId, purchaseId, printType, showDues, onClose, onPrinted }) {
  const isPurchase = !!purchaseId; // supplier purchase receipt: always an A4 letterhead page
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: null, doc: null });
  const [busy, setBusy] = useState(null); // 'print' | 'save'
  const [actionError, setActionError] = useState('');
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    setState({ loading: true, error: null, doc: null });
    const request = isPurchase
      ? window.api.printing.previewPurchase({ purchaseId })
      : window.api.printing.previewSale({ saleId, printType, showDues });
    request
      .then((res) => {
        if (cancelled) return;
        if (!res?.success) {
          setState({ loading: false, error: res?.reason || 'Could not build the preview.', doc: null });
          return;
        }
        objectUrl = base64ToBlobUrl(res.pdfBase64);
        setUrl(objectUrl);
        setState({ loading: false, error: null, doc: res });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err?.message || 'Could not build the preview.', doc: null });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [saleId, purchaseId, isPurchase, printType, showDues]);

  const { doc } = state;
  const isThermal = !isPurchase && printType !== 'wholesale-a4';

  async function handlePrint() {
    setBusy('print');
    setActionError('');
    try {
      const res = isPurchase ? await window.api.printing.printPurchase({ purchaseId }) : await window.api.printing.printSale({ saleId, printType, showDues });
      if (res?.success) {
        toast.success('Sent to the printer');
        onPrinted?.(res);
        onClose();
        return;
      }
      // A closed OS print dialog is not an error — stay open so they can retry or save.
      setActionError(res?.reason || 'The printer did not respond.');
    } catch (err) {
      setActionError(err?.message || 'The printer did not respond.');
    }
    setBusy(null);
  }

  async function handleSave() {
    if (!doc) return;
    setBusy('save');
    setActionError('');
    try {
      const res = await window.api.printing.savePdf({
        pdfBase64: doc.pdfBase64,
        defaultName: doc.invoiceNo ? `${isPurchase ? 'purchase' : 'invoice'}-${doc.invoiceNo}` : `receipt-${saleId || purchaseId}`,
      });
      if (res?.success) toast.success('Saved as PDF');
      else if (!res?.canceled) setActionError(res?.reason || 'Could not save the PDF.');
    } catch (err) {
      setActionError(err?.message || 'Could not save the PDF.');
    }
    setBusy(null);
  }

  const ready = !!doc && !busy;

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      dismissible={!busy}
      title="Print preview"
      subtitle={isThermal ? 'Receipt' : isPurchase ? 'A4 purchase receipt' : 'A4 invoice'}
      width={isThermal ? 440 : 860}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={!!busy}>
            Cancel
          </Button>
          <Button variant="secondary" icon={Download} onClick={handleSave} disabled={!ready} loading={busy === 'save'}>
            Save
          </Button>
          <Button icon={Printer} onClick={handlePrint} disabled={!ready} loading={busy === 'print'}>
            Print
          </Button>
        </>
      }
    >
      {doc?.stampLines?.length > 0 && (
        <div style={{ marginBottom: theme.spacing.sm }}>
          <Banner tone={doc.stampLines.some((s) => s.includes('VOIDED')) ? 'danger' : 'warning'}>
            {doc.stampLines.join(' · ')}
          </Banner>
        </div>
      )}
      <div style={{ ...styles.stage, height: isThermal ? '520px' : '620px' }}>
        {state.loading && (
          <div style={styles.note}>
            <Spinner size={16} /> Preparing preview…
          </div>
        )}
        {state.error && <div style={{ ...styles.note, color: c.redText }}>{state.error}</div>}
        {doc && url && <embed src={url} type="application/pdf" style={styles.pdf} />}
      </div>
      <Banner>{actionError}</Banner>
    </Modal>
  );
}

const styles = {
  stage: {
    display: 'flex',
    backgroundColor: c.bg,
    borderRadius: theme.radius.md,
    border: `1px solid ${c.separator}`,
    overflow: 'hidden',
  },
  pdf: { width: '100%', height: '100%', border: 'none' },
  note: { margin: 'auto', display: 'flex', alignItems: 'center', gap: theme.spacing.sm, ...theme.type.subhead, color: c.labelSecondary },
};
