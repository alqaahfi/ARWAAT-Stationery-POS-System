import React from 'react';
import theme from '../../../config/theme';
import { Card, Field, Textarea } from '../../../components/ui';

const c = theme.colors;

export function ReceiptForm({ headerText, onHeaderText, footerText, onFooterText }) {
  return (
    <Card title="What prints on receipts" style={{ flex: '1 1 400px', minWidth: 0 }}>
      <Field
        label="Header lines"
        hint="Printed at the top of every small receipt, exactly as typed — one line per line. The first line prints in bold."
      >
        <Textarea
          value={headerText}
          onChange={(e) => onHeaderText(e.target.value)}
          placeholder={'ARWAAT Stationery Store\n123 Main Road, Lahore\n0300-1234567'}
          rows={5}
          style={{ minHeight: '110px', fontFamily: theme.font.mono }}
        />
      </Field>
      <Field
        label="Footer lines"
        hint="Printed at the bottom of every small receipt, and under the totals on every A4 invoice."
        style={{ marginBottom: 0 }}
      >
        <Textarea
          value={footerText}
          onChange={(e) => onFooterText(e.target.value)}
          placeholder={'Thank you for shopping with us!\nExchange within 7 days with receipt.'}
          rows={4}
          style={{ minHeight: '90px', fontFamily: theme.font.mono }}
        />
      </Field>
    </Card>
  );
}

const edge = `2px dashed ${c.separatorStrong}`;
const muted = { color: c.labelTertiary };

// Rough mockup of a thermal receipt at the width chosen under Printers, so
// the owner sees the result without printing a test every time.
export function ReceiptPreview({ headerText, footerText, paperWidth }) {
  const width = paperWidth === '80mm' ? 300 : 230;
  const headerLines = headerText.split('\n').filter((l) => l.trim() !== '');
  const footerLines = footerText.split('\n').filter((l) => l.trim() !== '');

  return (
    <Card style={{ flex: '0 0 auto', backgroundColor: c.surfaceAlt }}>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginBottom: theme.spacing.sm }}>Preview · {paperWidth} paper</div>
      <div
        aria-label="Receipt preview"
        style={{
          width: `${width}px`,
          boxSizing: 'border-box',
          padding: '14px',
          backgroundColor: c.surface,
          color: c.label,
          fontFamily: theme.font.mono,
          fontSize: '12px',
          lineHeight: 1.6,
          borderTop: edge,
          borderBottom: edge,
          boxShadow: theme.shadow.card,
          overflowWrap: 'anywhere',
        }}
      >
        {headerLines.length ? (
          headerLines.map((line, i) => (
            <div key={i} style={{ textAlign: 'center', fontWeight: i === 0 ? theme.font.weightBold : theme.font.weightNormal }}>
              {line}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', ...muted }}>(no header lines yet)</div>
        )}

        <div style={{ borderTop: `1px dashed ${c.label}`, margin: '8px 0' }} />
        <div style={muted}>Invoice: MAIN-0001</div>
        <div style={muted}>...items...</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...muted }}>
          <span>Total</span>
          <span>Rs.0.00</span>
        </div>
        <div style={{ borderTop: `1px dashed ${c.label}`, margin: '8px 0' }} />

        {footerLines.length ? (
          footerLines.map((line, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              {line}
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', ...muted }}>(no footer lines yet)</div>
        )}
      </div>
    </Card>
  );
}
