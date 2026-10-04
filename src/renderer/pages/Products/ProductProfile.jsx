import React, { useCallback, useEffect, useState } from 'react';
import { History, PackageMinus, PackagePlus, PackageX, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { Button, Card, EmptyState, Skeleton } from '../../components/ui';
import StockEntryDialog from '../Stock/StockEntryDialog';
import { StatusBadges } from './list/StatusBadges';
import { MoveBadge } from './stock/MoveBadge';
import { formatCount, formatCurrency, formatDateOnly } from '../../utils/format';

const c = theme.colors;
const LEVELS = [1, 2, 3, 4, 5];

// Product Profile (/products/profile): an inventory view — stock first, then
// pricing across every tier, then sales figures and the latest stock changes.
// Deliberately laid out as a stock panel + pricing grid, unlike the ledger-style
// Customer / Supplier profiles. Buying prices, profit and the action buttons
// are for the Admin only.
export default function ProductProfile({ productId, onNavigate }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(null);
  const [moves, setMoves] = useState([]);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState(null); // 'add' | 'remove' | null

  const load = useCallback(async () => {
    try {
      const [p, s, m] = await Promise.all([
        window.api.products.getById({ id: productId }),
        window.api.stock.getProductStats({ productId }),
        window.api.stock.getMovements({ productId }),
      ]);
      if (!p) {
        setFailed(true);
        return;
      }
      setProduct(p);
      setStats(s?.success ? s : null);
      setMoves((m?.rows || []).slice(0, 8));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [productId]);

  useEffect(() => {
    setProduct(null);
    load();
  }, [load]);

  if (failed) {
    return (
      <Card style={{ maxWidth: '560px', margin: '0 auto' }}>
        <EmptyState
          icon={PackageX}
          color="red"
          title="We couldn't open this product"
          message="It may have been removed on another computer."
          action={<Button onClick={() => onNavigate('/products')}>Back to products</Button>}
        />
      </Card>
    );
  }
  if (!product) return <ProfileSkeleton />;

  const baseUnit = product.base_unit_name;
  const totalStock = product.variants.reduce((s, v) => s + (Number(v.stock_qty) || 0), 0);
  const status = stats || { isOutOfStock: totalStock === 0, isLow: false, isDead: false };
  const subline = [product.company_name, product.sku].filter(Boolean).join(' · ');
  const meta = [stats?.categoryName, stats?.supplierName && `Supplier: ${stats.supplierName}`].filter(Boolean).join(' · ');
  const alertAt = Number(product.min_stock_alert) || 0;
  const healthColor = status.isOutOfStock ? c.red : status.isLow ? c.orange : c.green;
  const fill = alertAt > 0 ? Math.min(100, (totalStock / (alertAt * 2)) * 100) : totalStock > 0 ? 100 : 0;
  const hasTrade = product.units.some((u) => u.pricing_method === 'trade');

  return (
    <div style={{ paddingBottom: theme.spacing.xxl }}>
      <div style={styles.header}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <h2 style={{ ...theme.type.title1, color: c.label, margin: 0, overflowWrap: 'anywhere' }}>{product.name}</h2>
          {subline && <div style={{ ...theme.type.subhead, color: c.labelSecondary, marginTop: '2px' }}>{subline}</div>}
          {meta && <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' }}>{meta}</div>}
          <div style={{ marginTop: theme.spacing.sm }}>
            <StatusBadges row={{ ...status, is_active: product.is_active }} />
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Button variant="secondary" icon={Pencil} onClick={() => onNavigate('/products/edit', { id: productId })}>
              Edit
            </Button>
            <Button variant="tinted" icon={PackageMinus} onClick={() => setDialog('remove')}>
              Delete Stock
            </Button>
            <Button icon={PackagePlus} onClick={() => setDialog('add')}>
              Add Stock
            </Button>
          </div>
        )}
      </div>

      <div style={styles.columns}>
        <div style={styles.side}>
          <Card padding={theme.spacing.mdl}>
            <Label>In stock</Label>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
              <span style={{ ...theme.type.largeTitle, ...theme.font.numeric, color: healthColor }}>{formatCount(totalStock)}</span>
              <span style={{ ...theme.type.body, color: c.labelSecondary }}>{baseUnit}</span>
            </div>
            <div style={styles.track} aria-hidden="true">
              <div style={{ width: `${fill}%`, height: '100%', backgroundColor: healthColor, borderRadius: theme.radius.pill }} />
            </div>
            <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '6px' }}>
              {alertAt > 0 ? `Running Low at ${formatCount(alertAt)} ${baseUnit} or less` : 'No low-stock warning set'}
            </div>
            <div style={{ marginTop: theme.spacing.md }}>
              {product.variants.map((v) => (
                <div key={v.id} style={styles.kv}>
                  <span style={{ color: c.label }}>{v.variant_name}</span>
                  <span style={{ ...theme.font.numeric, color: c.label, fontWeight: theme.font.weightSemibold }}>
                    {formatCount(v.stock_qty)} <span style={{ color: c.labelSecondary, fontWeight: 400 }}>{baseUnit}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card padding={theme.spacing.mdl}>
            <Label>Sales</Label>
            {stats ? (
              <div style={{ marginTop: theme.spacing.sm }}>
                <Tile label="Sold in the last 30 days" value={`${formatCount(stats.last30BaseQty)} ${baseUnit}`} sub={formatCurrency(stats.last30Revenue)} />
                <Tile label="Sold in total" value={`${formatCount(stats.soldBaseQty)} ${baseUnit}`} sub={`${formatCount(stats.salesCount)} sale${stats.salesCount === 1 ? '' : 's'}`} />
                <Tile label="Sales value" value={formatCurrency(stats.revenue)} />
                {isAdmin && <Tile label="Estimated profit" value={formatCurrency(stats.profit)} sub="at today's buying price" tone={stats.profit >= 0 ? c.greenText : c.redText} />}
                <div style={styles.kv}>
                  <span style={{ color: c.labelSecondary }}>Last sold</span>
                  <span style={{ color: c.label }}>{stats.lastSoldAt ? formatDateOnly(stats.lastSoldAt) : glossary.neverSold}</span>
                </div>
                {isAdmin && (
                  <div style={styles.kv}>
                    <span style={{ color: c.labelSecondary }}>Last stocked</span>
                    <span style={{ color: c.label }}>{stats.lastPurchasedAt ? formatDateOnly(stats.lastPurchasedAt) : '—'}</span>
                  </div>
                )}
              </div>
            ) : (
              <Skeleton lines={4} style={{ marginTop: theme.spacing.sm }} />
            )}
          </Card>
        </div>

        <div style={styles.main}>
          <Card padding="0" style={{ overflow: 'hidden' }}>
            <SectionTitle>Pricing</SectionTitle>
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <Th>{glossary.packSizes}</Th>
                    <Th right>{glossary.contains}</Th>
                    <Th right>Retail</Th>
                    <Th right>Wholesale</Th>
                    {isAdmin && <Th right>Buying</Th>}
                    {LEVELS.map((n) => (
                      <Th key={n} right>
                        {glossary.priceLevel(n)}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {product.units.map((u) => (
                    <React.Fragment key={u.id}>
                      <tr>
                        <Td>
                          <span style={{ fontWeight: theme.font.weightSemibold }}>{u.unit_name}</span>
                          {u.is_default_sale_unit ? <span style={{ color: c.labelTertiary }}> · default</span> : null}
                          {u.pricing_method === 'trade' && <span style={styles.tradeTag}>Trade Price</span>}
                        </Td>
                        <Td right>
                          {formatCount(u.conversion_factor)} {baseUnit}
                        </Td>
                        <Td right>{formatCurrency(u.retail_price)}</Td>
                        <Td right>{formatCurrency(u.wholesale_price)}</Td>
                        {isAdmin && <Td right>{formatCurrency(u.cost_price)}</Td>}
                        {LEVELS.map((n) => {
                          const rate = u[`net_rate_c${n}`];
                          const set = rate !== null && rate !== undefined;
                          return (
                            <Td key={n} right muted={!set}>
                              {set ? formatCurrency(rate) : '—'}
                            </Td>
                          );
                        })}
                      </tr>
                      {isAdmin && u.pricing_method === 'trade' && (
                        <tr>
                          <td colSpan={5 + LEVELS.length} style={styles.tradeLine}>
                            Trade price {formatCurrency(u.trade_price)} · purchase discount {formatCount(u.purchase_discount || 0)}% · extra discount {formatCurrency(u.extra_discount || 0)}
                            {LEVELS.filter((n) => u[`sale_discount_c${n}`] != null).map((n) => ` · L${n} −${formatCount(u[`sale_discount_c${n}`])}%`)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ ...theme.type.footnote, color: c.labelSecondary, padding: `8px ${theme.spacing.md} 12px` }}>
              {product.pricing_type === 'percentage'
                ? `Priced as buying price + ${formatCount(product.default_percentage)}% unless a Price Level rate is set.`
                : 'A Price Level rate replaces Retail / Wholesale for customers on that level.'}
              {!hasTrade ? '' : ' Trade Price items keep their trade price and discounts on the pack size.'}
            </div>
          </Card>

          <Card padding="0" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <SectionTitle>Recent stock changes</SectionTitle>
              {isAdmin && <Button variant="plain" size="sm" icon={History} style={{ marginRight: theme.spacing.sm }} onClick={() => onNavigate('/stock/history', { productId })}>
                Full history
              </Button>}
            </div>
            {moves.length === 0 ? (
              <div style={{ ...theme.type.subhead, color: c.labelSecondary, padding: `0 ${theme.spacing.md} ${theme.spacing.md}` }}>No stock changes yet.</div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {moves.map((m) => (
                  <li key={m.id} style={styles.moveRow}>
                    <span style={{ width: '110px', ...theme.type.footnote, color: c.labelSecondary }}>{formatDateOnly(m.created_at)}</span>
                    <span style={{ width: '120px' }}>
                      <MoveBadge type={m.movement_type} referenceType={m.reference_type} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0, ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[m.variant_name !== 'Standard' ? m.variant_name : null, m.sale_invoice_no && `Invoice ${m.sale_invoice_no}`, m.note].filter(Boolean).join(' · ')}
                    </span>
                    <span style={{ ...theme.type.subhead, ...theme.font.numeric, fontWeight: theme.font.weightSemibold, color: m.quantity > 0 ? c.greenText : c.redText }}>
                      {m.quantity > 0 ? '+' : '−'}
                      {formatCount(Math.abs(m.quantity))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {product.notes && (
            <Card padding={theme.spacing.md}>
              <Label>Notes</Label>
              <div style={{ ...theme.type.body, color: c.label, marginTop: '4px', whiteSpace: 'pre-wrap' }}>{product.notes}</div>
            </Card>
          )}
        </div>
      </div>

      {dialog && (
        <StockEntryDialog open mode={dialog} productId={productId} productName={product.name} onSaved={load} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Label({ children }) {
  return <div style={{ ...theme.type.footnote, fontWeight: theme.font.weightSemibold, textTransform: 'uppercase', letterSpacing: '0.04em', color: c.labelSecondary }}>{children}</div>;
}

function SectionTitle({ children }) {
  return <h3 style={{ ...theme.type.headline, color: c.label, margin: 0, padding: `14px ${theme.spacing.md} 8px`, flex: 1 }}>{children}</h3>;
}

function Tile({ label, value, sub, tone }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: `1px solid ${c.separator}` }}>
      <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{label}</div>
      <div style={{ ...theme.type.title2, ...theme.font.numeric, color: tone || c.label }}>{value}</div>
      {sub && <div style={{ ...theme.type.footnote, color: c.labelSecondary }}>{sub}</div>}
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th scope="col" style={{ textAlign: right ? 'right' : 'left', ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary, padding: '8px 12px', backgroundColor: c.surfaceAlt, borderTop: `1px solid ${c.separator}`, borderBottom: `1px solid ${c.separator}`, whiteSpace: 'nowrap' }}>
      {children}
    </th>
  );
}

function Td({ children, right, muted }) {
  return (
    <td style={{ textAlign: right ? 'right' : 'left', ...(right ? theme.font.numeric : null), padding: '10px 12px', color: muted ? c.labelTertiary : c.label, whiteSpace: 'nowrap', borderBottom: `1px solid ${c.separator}` }}>
      {children}
    </td>
  );
}

function ProfileSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <Skeleton width="40%" height="28px" />
      <Skeleton lines={6} />
    </div>
  );
}

const styles = {
  header: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: theme.spacing.md, marginBottom: theme.spacing.md },
  columns: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md, alignItems: 'flex-start' },
  side: { flex: '0 0 300px', display: 'flex', flexDirection: 'column', gap: theme.spacing.md, minWidth: '260px' },
  main: { flex: '1 1 520px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.spacing.md },
  track: { height: '8px', borderRadius: theme.radius.pill, backgroundColor: c.fill, marginTop: theme.spacing.smd, overflow: 'hidden' },
  kv: { display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm, padding: '6px 0', ...theme.type.subhead },
  table: { width: '100%', borderCollapse: 'collapse', ...theme.type.subhead },
  tradeTag: { marginLeft: '8px', padding: '1px 8px', borderRadius: theme.radius.pill, backgroundColor: c.indigoTint, color: c.indigoText, ...theme.type.caption },
  tradeLine: { padding: '0 12px 8px', ...theme.type.footnote, ...theme.font.numeric, color: c.labelSecondary, borderBottom: `1px solid ${c.separator}` },
  moveRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, padding: `8px ${theme.spacing.md}`, borderTop: `1px solid ${c.separator}` },
};
