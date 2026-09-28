import React, { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import theme from '../../../config/theme';
import { Card, Checkbox, Icon, Skeleton, Toggle } from '../../../components/ui';
import useInteraction from '../../../components/kit/useInteraction';
import { formatCount } from '../../../utils/format';
import { StatusBadges, StatusDot } from './StatusBadges';
import { ProductDetail } from './ProductDetail';

const c = theme.colors;
const srOnly = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

function columnsFor(compact, isAdmin) {
  const sel = isAdmin ? '32px ' : '';
  return compact
    ? `${sel}minmax(0, 1fr) 140px 150px 24px`
    : `${sel}minmax(0, 2.2fr) minmax(0, 1.2fr) 140px minmax(0, 1.6fr) ${isAdmin ? '56px ' : ''}24px`;
}

const cellGap = theme.spacing.smd;

// Stops a click on a control inside the row from also expanding the row.
function Stop({ children, style }) {
  return (
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', ...style }}>
      {children}
    </div>
  );
}

// List + Compact views share one grid-based table.
export function ProductTable({ rows, compact, isAdmin, expandedIds, selectedIds, detailCache, loadingDetailIds, detailErrorIds, actions }) {
  const columns = columnsFor(compact, isAdmin);
  const head = { ...theme.type.footnote, fontWeight: theme.font.weightSemibold, color: c.labelSecondary };

  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: cellGap,
          alignItems: 'center',
          padding: `0 ${theme.spacing.md}`,
          height: '34px',
          backgroundColor: c.surfaceAlt,
          borderBottom: `1px solid ${c.separator}`,
        }}
      >
        {isAdmin && <span />}
        <span style={head}>Product</span>
        {!compact && <span style={head}>Category</span>}
        <span style={{ ...head, textAlign: 'right' }}>Stock</span>
        <span style={head}>Status</span>
        {!compact && isAdmin && <span style={head}>Active</span>}
        <span />
      </div>
      {rows.map((p) => (
        <ProductRow
          key={p.id}
          product={p}
          compact={compact}
          columns={columns}
          isAdmin={isAdmin}
          expanded={expandedIds.has(p.id)}
          selected={selectedIds.has(p.id)}
          detail={detailCache[p.id]}
          detailLoading={loadingDetailIds.has(p.id)}
          detailError={detailErrorIds.has(p.id)}
          actions={actions}
        />
      ))}
    </Card>
  );
}

const ProductRow = memo(function ProductRow({ product: p, compact, columns, isAdmin, expanded, selected, detail, detailLoading, detailError, actions }) {
  const { hovered, handlers } = useInteraction(false);
  const subline = [p.company_name, p.sku].filter(Boolean).join(' · ');

  return (
    <div style={{ borderBottom: `1px solid ${c.separator}` }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => actions.toggleExpand(p.id)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            actions.toggleExpand(p.id);
          }
        }}
        {...handlers}
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: cellGap,
          alignItems: 'center',
          minHeight: compact ? '40px' : '56px',
          padding: `${compact ? 4 : 6}px ${theme.spacing.md}`,
          boxSizing: 'border-box',
          backgroundColor: selected ? c.accentTint : hovered || expanded ? c.surfaceAlt : c.surface,
          cursor: 'pointer',
          transition: `background-color ${theme.motion.fast} ease`,
        }}
      >
        {isAdmin && (
          <Stop>
            <Checkbox
              checked={selected}
              onChange={() => actions.toggleSelect(p.id)}
              label={<span style={srOnly}>Select {p.name}</span>}
              style={{ marginTop: 0, gap: 0 }}
            />
          </Stop>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...(compact ? theme.type.subhead : theme.type.body),
              fontWeight: theme.font.weightSemibold,
              color: p.is_active ? c.label : c.labelSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p.name}
          </div>
          {!compact && subline && (
            <div style={{ ...theme.type.footnote, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subline}</div>
          )}
        </div>
        {!compact && (
          <div style={{ ...theme.type.subhead, color: c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.category_name || '—'}
          </div>
        )}
        <div style={{ ...theme.type.subhead, ...theme.font.numeric, textAlign: 'right', whiteSpace: 'nowrap', color: c.label }}>
          {formatCount(p.total_stock)} <span style={{ color: c.labelSecondary }}>{p.base_unit_name}</span>
        </div>
        <div style={{ minWidth: 0 }}>{compact ? <StatusDot row={p} /> : <StatusBadges row={p} />}</div>
        {!compact && isAdmin && (
          <Stop>
            <Toggle checked={!!p.is_active} onChange={() => actions.toggleActive(p)} label={`${p.name} is active`} />
          </Stop>
        )}
        <Icon
          icon={ChevronDown}
          size={16}
          style={{ color: c.labelTertiary, transform: expanded ? 'rotate(180deg)' : 'none', transition: `transform ${theme.motion.base} ${theme.motion.easing}` }}
        />
      </div>
      {expanded && (
        <ProductDetail
          detail={detail}
          loading={detailLoading}
          error={detailError}
          isAdmin={isAdmin}
          onRetry={() => actions.retryDetail(p.id)}
          onEdit={() => actions.go('/products/edit', { id: p.id })}
          onFixStock={() => actions.go('/products/stock-adjustments', { productId: p.id })}
          onHistory={() => actions.go('/products/stock-movements', { productId: p.id })}
        />
      )}
    </div>
  );
});

// Cards view: several can be open at once.
export function ProductCards({ rows, isAdmin, expandedIds, detailCache, loadingDetailIds, detailErrorIds, actions }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: theme.spacing.md, alignItems: 'start' }}>
      {rows.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          isAdmin={isAdmin}
          expanded={expandedIds.has(p.id)}
          detail={detailCache[p.id]}
          detailLoading={loadingDetailIds.has(p.id)}
          detailError={detailErrorIds.has(p.id)}
          actions={actions}
        />
      ))}
    </div>
  );
}

const ProductCard = memo(function ProductCard({ product: p, isAdmin, expanded, detail, detailLoading, detailError, actions }) {
  const { hovered, handlers } = useInteraction(false);
  const types = p.variant_count > 1 ? `${p.variant_count} Types` : 'Single item';
  const packs = `${p.unit_count} pack size${p.unit_count === 1 ? '' : 's'}`;

  return (
    <div
      style={{
        gridColumn: expanded ? '1 / -1' : undefined,
        backgroundColor: c.surface,
        border: `1px solid ${expanded ? c.separatorStrong : c.separator}`,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => actions.toggleExpand(p.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            actions.toggleExpand(p.id);
          }
        }}
        {...handlers}
        style={{
          padding: theme.spacing.md,
          cursor: 'pointer',
          backgroundColor: hovered ? c.surfaceAlt : c.surface,
          transition: `background-color ${theme.motion.fast} ease`,
        }}
      >
        <div style={{ ...theme.type.headline, color: p.is_active ? c.label : c.labelSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.name}
        </div>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: '2px' }}>{p.category_name || 'No category'}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: theme.spacing.smd }}>
          <span style={{ ...theme.type.title1, ...theme.font.numeric, color: c.label }}>{formatCount(p.total_stock)}</span>
          <span style={{ ...theme.type.subhead, color: c.labelSecondary }}>{p.base_unit_name}</span>
        </div>
        <div style={{ marginTop: theme.spacing.sm }}>
          <StatusBadges row={p} />
        </div>
        <div style={{ ...theme.type.footnote, color: c.labelSecondary, marginTop: theme.spacing.sm }}>
          {types} · {packs}
        </div>
      </div>
      {expanded && (
        <ProductDetail
          detail={detail}
          loading={detailLoading}
          error={detailError}
          isAdmin={isAdmin}
          onRetry={() => actions.retryDetail(p.id)}
          onEdit={() => actions.go('/products/edit', { id: p.id })}
          onFixStock={() => actions.go('/products/stock-adjustments', { productId: p.id })}
          onHistory={() => actions.go('/products/stock-movements', { productId: p.id })}
        />
      )}
    </div>
  );
});

export function SkeletonRows({ count = 6 }) {
  return (
    <Card padding="0" style={{ overflow: 'hidden' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.lg,
            height: '56px',
            padding: `0 ${theme.spacing.md}`,
            borderBottom: i < count - 1 ? `1px solid ${c.separator}` : 'none',
          }}
        >
          <div style={{ flex: 2 }}>
            <Skeleton width="55%" />
            <Skeleton width="30%" height="10px" style={{ marginTop: '6px' }} />
          </div>
          <Skeleton width="90px" style={{ flex: 1 }} />
          <Skeleton width="70px" />
          <Skeleton width="80px" height="18px" radius={theme.radius.pill} />
        </div>
      ))}
    </Card>
  );
}
