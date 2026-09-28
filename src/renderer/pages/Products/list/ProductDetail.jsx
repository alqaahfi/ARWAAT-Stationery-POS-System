import React from 'react';
import { ClipboardCheck, History, Pencil } from 'lucide-react';
import theme from '../../../config/theme';
import glossary from '../../../config/glossary';
import { Button, Skeleton } from '../../../components/ui';
import { formatCount, formatCurrency, formatDateTime } from '../../../utils/format';

const c = theme.colors;
const LEVELS = [1, 2, 3, 4, 5];

// Inline detail under an expanded product: its Types and pack sizes.
// Buying price only for the owner.
export function ProductDetail({ detail, loading, error, isAdmin, onRetry, onEdit, onFixStock, onHistory }) {
  let body;
  if (error) {
    body = (
      <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.smd, ...theme.type.subhead, color: c.redText }}>
        Couldn't load this product's details.
        <Button variant="plain" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  } else if (loading || !detail) {
    body = (
      <div style={{ display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
        <Skeleton lines={3} style={{ flex: 1, minWidth: '240px' }} />
        <Skeleton lines={3} style={{ flex: 1, minWidth: '240px' }} />
      </div>
    );
  } else {
    body = (
      <>
        <div style={{ display: 'flex', gap: theme.spacing.lg, flexWrap: 'wrap' }}>
          <MiniTable
            title={glossary.types}
            columns={[
              { label: 'Type' },
              { label: 'Barcode' },
              { label: 'In stock', numeric: true },
              { label: 'Last sold' },
            ]}
            rows={detail.variants.map((v) => ({
              key: v.id,
              cells: [
                v.variant_name,
                v.barcode || '—',
                `${formatCount(v.stock_qty)} ${detail.base_unit_name}`,
                v.last_sold_at ? formatDateTime(v.last_sold_at) : glossary.neverSold,
              ],
            }))}
          />
          <MiniTable
            title={glossary.packSizes}
            columns={[
              { label: 'Pack size' },
              { label: glossary.contains, numeric: true },
              { label: 'Retail', numeric: true },
              { label: 'Wholesale', numeric: true },
              ...(isAdmin ? [{ label: 'Buying', numeric: true }] : []),
            ]}
            rows={detail.units.map((u) => ({
              key: u.id,
              cells: [
                <span>
                  {u.unit_name}
                  {u.is_default_sale_unit ? <span style={{ color: c.labelTertiary }}> · default</span> : null}
                </span>,
                `${formatCount(u.conversion_factor)} ${detail.base_unit_name}`,
                formatCurrency(u.retail_price),
                formatCurrency(u.wholesale_price),
                ...(isAdmin ? [formatCurrency(u.cost_price)] : []),
              ],
              extra: specialPricesLine(u),
            }))}
          />
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.md, flexWrap: 'wrap' }}>
            <Button variant="tinted" size="sm" icon={Pencil} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="plain" size="sm" icon={ClipboardCheck} onClick={onFixStock}>
              {glossary.fixStockCount}
            </Button>
            <Button variant="plain" size="sm" icon={History} onClick={onHistory}>
              {glossary.stockHistory}
            </Button>
          </div>
        )}
      </>
    );
  }

  return <div style={{ backgroundColor: c.surfaceAlt, padding: theme.spacing.md, animation: `fade-in ${theme.motion.base} ease` }}>{body}</div>;
}

function specialPricesLine(unit) {
  const set = LEVELS.filter((n) => unit[`net_rate_c${n}`] !== null && unit[`net_rate_c${n}`] !== undefined);
  if (!set.length) return null;
  return set.map((n) => `${glossary.priceLevel(n)}: ${formatCurrency(unit[`net_rate_c${n}`])}`).join(' · ');
}

function MiniTable({ title, columns, rows }) {
  const th = (col) => ({
    textAlign: col.numeric ? 'right' : 'left',
    ...theme.type.footnote,
    fontWeight: theme.font.weightSemibold,
    color: c.labelSecondary,
    padding: '6px 8px',
    borderBottom: `1px solid ${c.separator}`,
    whiteSpace: 'nowrap',
  });
  const td = (col) => ({
    textAlign: col.numeric ? 'right' : 'left',
    ...(col.numeric ? { ...theme.font.numeric, whiteSpace: 'nowrap' } : null),
    padding: '6px 8px',
    color: c.label,
  });
  return (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <div style={{ ...theme.type.footnote, fontWeight: theme.font.weightSemibold, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.labelSecondary, marginBottom: '4px' }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', ...theme.type.subhead }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.label} scope="col" style={th(col)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <tr style={{ borderBottom: row.extra ? 'none' : `1px solid ${c.separator}` }}>
                {row.cells.map((cell, i) => (
                  <td key={i} style={td(columns[i])}>
                    {cell}
                  </td>
                ))}
              </tr>
              {row.extra && (
                <tr style={{ borderBottom: `1px solid ${c.separator}` }}>
                  <td colSpan={columns.length} style={{ padding: '0 8px 6px', ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary }}>
                    {row.extra}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
