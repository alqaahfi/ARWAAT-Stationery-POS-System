import React, { useEffect, useRef, useState } from 'react';
import { PauseCircle } from 'lucide-react';
import theme from '../../../config/theme';
import { Button, EmptyState, Kbd } from '../../../components/ui';
import { Scrim, c, keepFocus } from './common';

// Recall menu for held bills. ↑↓ choose, Enter recalls, Delete discards, Esc closes.
// Owns its keys while open — Sale.jsx stands down (see showRecall in its handler).
export default function HeldBillsPanel({ held, onRecall, onDiscard, onClose }) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, held.length - 1));

  const handlerRef = useRef(() => {});
  handlerRef.current = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, held.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && held[safeIndex]) {
      e.preventDefault();
      onRecall(held[safeIndex].id);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && held[safeIndex]) {
      e.preventDefault();
      onDiscard(held[safeIndex].id);
    }
  };
  useEffect(() => {
    const listener = (e) => handlerRef.current(e);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  return (
    <Scrim labelledBy="pos-held-title">
      <div style={styles.card}>
        <div style={styles.header}>
          <div id="pos-held-title" style={{ ...theme.type.title2, color: c.label }}>
            Held bills
          </div>
          <Button variant="secondary" size="sm" tabIndex={-1} onMouseDown={keepFocus} onClick={onClose}>
            Close <Kbd>Esc</Kbd>
          </Button>
        </div>

        {held.length === 0 ? (
          <EmptyState icon={PauseCircle} title="Nothing on hold" message="Press F4 during a sale to put it on hold." style={{ padding: '32px' }} />
        ) : (
          <div style={styles.list} role="listbox" aria-label="Held bills">
            {held.map((h, i) => (
              <div
                key={h.id}
                role="option"
                aria-selected={i === safeIndex}
                onClick={() => setIndex(i)}
                onDoubleClick={() => onRecall(h.id)}
                style={{ ...styles.row, backgroundColor: i === safeIndex ? c.accentTint : 'transparent' }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ ...theme.type.body, fontWeight: theme.font.weightSemibold, color: c.label }}>{h.name}</div>
                  <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>
                    {h.lines.length} {h.lines.length === 1 ? 'item' : 'items'} · held at {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span onMouseDown={keepFocus} style={{ display: 'flex', gap: theme.spacing.xs }}>
                  <Button variant="danger" size="sm" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onDiscard(h.id); }}>
                    Discard
                  </Button>
                  <Button size="sm" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onRecall(h.id); }}>
                    Recall
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={styles.footer}>
          <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> Choose</span>
          <span><Kbd>Enter</Kbd> Recall</span>
          <span><Kbd>Delete</Kbd> Discard</span>
        </div>
      </div>
    </Scrim>
  );
}

const styles = {
  card: { width: '520px', maxWidth: '100%', maxHeight: '100%', display: 'flex', flexDirection: 'column', backgroundColor: c.surface, borderRadius: theme.radius.xl, boxShadow: theme.shadow.modal, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${c.separator}` },
  list: { overflowY: 'auto', padding: theme.spacing.sm },
  row: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: '10px 12px', borderRadius: theme.radius.md, cursor: 'pointer' },
  footer: { display: 'flex', gap: theme.spacing.lg, padding: '10px 20px', borderTop: `1px solid ${c.separator}`, ...theme.type.footnote, color: c.labelSecondary },
};
