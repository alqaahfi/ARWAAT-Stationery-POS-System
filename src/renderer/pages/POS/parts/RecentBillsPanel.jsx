import React, { useEffect, useRef, useState } from 'react';
import { Lock, Receipt } from 'lucide-react';
import theme from '../../../config/theme';
import { formatCurrency, formatDateTime } from '../../../utils/format';
import { Badge, Button, EmptyState, Kbd, Spinner } from '../../../components/ui';
import AdminApprovalDialog from '../../../components/billing/AdminApprovalDialog';
import { InlineMessage, Money, Scrim, c, keepFocus } from './common';

// Today's bills for this cashier (Admin: everyone's). ↑↓ walks the list and the
// right side follows instantly; Enter loads the bill back into the sale to edit,
// Delete voids it (asks first). This panel owns its own keys while open — Sale.jsx
// stands down (see showRecent in its handler).
export default function RecentBillsPanel({ userId, onClose, onEdit, onVoided }) {
  const [bills, setBills] = useState(null);
  const [index, setIndex] = useState(0);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState(null); // rule 12: { labels, message } while the Admin approval box is open
  const listRef = useRef(null);

  async function load(keepIndex) {
    const rows = await window.api.sales.listRecent({ userId });
    setBills(rows);
    setIndex((i) => Math.max(0, Math.min(keepIndex ? i : 0, rows.length - 1)));
  }

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = bills && bills[index];

  useEffect(() => {
    setConfirmVoid(false);
    setError('');
    if (!selected) {
      setDetail(null);
      return undefined;
    }
    let cancelled = false;
    window.api.sales.getSaleDetail({ saleId: selected.id }).then((d) => {
      if (!cancelled) setDetail(d);
    });
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function doVoid(approvalToken) {
    if (!selected || busy) return;
    setBusy(true);
    const res = await window.api.sales.void({ saleId: selected.id, userId, approvalToken });
    setBusy(false);
    if (!res.success) {
      // Rule 12: an older bill needs the Admin's approval — ask right here.
      if (res.needsApproval) {
        setApproval({ labels: res.approvalLabels || [], message: res.reason });
        return;
      }
      setConfirmVoid(false);
      setError(res.reason);
      return;
    }
    onVoided(res.invoiceNo);
    load(true);
  }

  function edit() {
    if (selected && !selected.locked) onEdit(selected.id);
  }

  const handlerRef = useRef(() => {});
  handlerRef.current = (e) => {
    if (approval) return; // the approval box owns the keyboard
    if (e.key === 'Escape') {
      e.preventDefault();
      if (confirmVoid) setConfirmVoid(false);
      else onClose();
    } else if (confirmVoid) {
      if (e.key === 'Enter') {
        e.preventDefault();
        doVoid();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, (bills?.length || 1) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      edit();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !selected.locked) {
      e.preventDefault();
      setConfirmVoid(true);
    }
  };
  useEffect(() => {
    const listener = (e) => handlerRef.current(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <Scrim labelledBy="pos-recent-title">
      {approval && (
        <AdminApprovalDialog
          labels={approval.labels}
          message={approval.message}
          onClose={() => {
            setApproval(null);
            setConfirmVoid(false);
          }}
          onApproved={(token) => {
            setApproval(null);
            doVoid(token);
          }}
        />
      )}
      <div style={styles.card}>
        <div style={styles.header}>
          <div id="pos-recent-title" style={{ ...theme.type.title2, color: c.label }}>
            Today's bills
          </div>
          <Button variant="secondary" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onClose}>
            Close <Kbd>Esc</Kbd>
          </Button>
        </div>

        {bills === null ? (
          <div style={styles.center}>
            <Spinner />
          </div>
        ) : bills.length === 0 ? (
          <EmptyState icon={Receipt} title="No bills yet today" message="Bills you make today will show up here." style={{ margin: 'auto' }} />
        ) : (
          <div style={styles.body}>
            <div ref={listRef} style={styles.list} role="listbox" aria-label="Today's bills">
              {bills.map((b, i) => (
                <div
                  key={b.id}
                  role="option"
                  aria-selected={i === index}
                  aria-current={i === index ? 'true' : undefined}
                  onClick={() => setIndex(i)}
                  style={{ ...styles.billRow, backgroundColor: i === index ? c.accentTint : 'transparent' }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{b.invoice_no}</div>
                    <div style={{ ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.customer_name || 'Walk-in'} · {b.item_count} {b.item_count === 1 ? 'item' : 'items'}
                    </div>
                    {b.is_voided && <Badge tone="red" size="sm">Voided</Badge>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Money value={formatCurrency(b.total_amount)} style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }} />
                    {b.balance_due > 0 && <div style={{ ...theme.type.caption, color: c.orangeText }}>Due {formatCurrency(b.balance_due)}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.detail}>
              {!detail ? (
                <div style={styles.center}>
                  <Spinner />
                </div>
              ) : (
                <BillDetail
                  detail={detail}
                  locked={selected.locked}
                  confirmVoid={confirmVoid}
                  busy={busy}
                  onEdit={edit}
                  onAskVoid={() => setConfirmVoid(true)}
                  onVoid={() => doVoid()}
                  onKeep={() => setConfirmVoid(false)}
                />
              )}
              <InlineMessage tone="error">{error}</InlineMessage>
            </div>
          </div>
        )}

        <div style={styles.footer}>
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> Browse</span>
          <span><Kbd>Enter</Kbd> Edit bill</span>
          <span><Kbd>Delete</Kbd> Void bill</span>
        </div>
      </div>
    </Scrim>
  );
}

function BillDetail({ detail, locked, confirmVoid, busy, onEdit, onAskVoid, onVoid, onKeep }) {
  const { sale, items } = detail;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.sm }}>
        <div>
          <div style={{ ...theme.type.headline, color: c.label }}>{sale.invoice_no}</div>
          <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
            {formatDateTime(sale.created_at)} · {sale.cashier_name}
          </div>
          <div style={{ ...theme.type.subhead, color: c.label, marginTop: '2px' }}>{sale.customer_name || 'Walk-in'}</div>
        </div>
        <Badge tone={sale.payment_status === 'paid' ? 'green' : sale.payment_status === 'partial' ? 'orange' : 'red'}>{sale.payment_status}</Badge>
      </div>

      <div style={styles.lines}>
        {items.map((it) => (
          <div key={it.id} style={styles.line}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...theme.type.body, color: c.label }}>{it.product_name}</div>
              <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
                {it.quantity} {it.unit_name} × {formatCurrency(it.unit_price)}
                {it.foc_quantity > 0 && <span style={{ color: c.greenText }}> + {it.foc_quantity} free</span>}
              </div>
            </div>
            <Money value={formatCurrency(it.line_total)} style={{ ...theme.type.body, color: c.label }} />
          </div>
        ))}
      </div>

      <div style={styles.totals}>
        <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
        {sale.discount_amount > 0 && <Row label="Discount" value={`− ${formatCurrency(sale.discount_amount)}`} />}
        <Row label="Total" value={formatCurrency(sale.total_amount)} strong />
        <Row label="Paid" value={formatCurrency(sale.paid_amount)} />
        {sale.balance_due > 0 && <Row label="Balance due" value={formatCurrency(sale.balance_due)} color={c.orangeText} strong />}
      </div>

      {locked ? (
        <InlineMessage tone="info">
          <Lock size={12} aria-hidden="true" />{' '}
          {sale.is_voided ? 'This bill was voided. It counts as zero and can no longer be changed.' : "Items were returned from this bill, so it can't be changed."}
        </InlineMessage>
      ) : confirmVoid ? (
        <div style={{ marginTop: theme.spacing.smd }} onMouseDown={keepFocus}>
          <InlineMessage tone="warning">Void this bill? Stock goes back on the shelf and the customer's balance is corrected. The bill stays in Sales History marked Voided.</InlineMessage>
          <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <Button variant="secondary" fullWidth tabIndex={-1} onClick={onKeep}>
              Keep bill <Kbd>Esc</Kbd>
            </Button>
            <Button variant="dangerFilled" fullWidth tabIndex={-1} disabled={busy} onClick={onVoid}>
              Void bill <Kbd>Enter</Kbd>
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.smd }} onMouseDown={keepFocus}>
          <Button variant="danger" fullWidth tabIndex={-1} onClick={onAskVoid}>
            Void
          </Button>
          <Button fullWidth tabIndex={-1} onClick={onEdit}>
            Edit bill
          </Button>
        </div>
      )}
    </>
  );
}

function Row({ label, value, color, strong }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', ...theme.type.body }}>
      <span style={{ color: color || c.labelSecondary, fontWeight: strong ? theme.font.weightSemibold : undefined }}>{label}</span>
      <Money value={value} style={{ color: color || c.label, fontWeight: strong ? theme.font.weightSemibold : theme.font.weightMedium }} />
    </div>
  );
}

const styles = {
  card: {
    width: '880px',
    maxWidth: '100%',
    height: '600px',
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: c.surface,
    borderRadius: theme.radius.xl,
    boxShadow: theme.shadow.modal,
    overflow: 'hidden',
  },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${c.separator}` },
  body: { flex: 1, minHeight: 0, display: 'flex' },
  list: { width: '340px', flexShrink: 0, overflowY: 'auto', padding: theme.spacing.sm, borderRight: `1px solid ${c.separator}` },
  billRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: '8px 10px', borderRadius: theme.radius.md, cursor: 'pointer', minHeight: '52px', boxSizing: 'border-box' },
  detail: { flex: 1, minWidth: 0, overflowY: 'auto', padding: theme.spacing.md },
  lines: { margin: `${theme.spacing.smd} 0`, borderTop: `1px solid ${c.separator}`, borderBottom: `1px solid ${c.separator}`, padding: '4px 0' },
  line: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: '6px 0' },
  totals: { padding: '2px 0' },
  center: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' },
  footer: { display: 'flex', gap: theme.spacing.lg, padding: '10px 20px', borderTop: `1px solid ${c.separator}`, ...theme.type.footnote, color: c.labelSecondary },
};
