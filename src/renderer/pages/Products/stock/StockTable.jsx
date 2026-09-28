import React from 'react';
import theme from '../../../config/theme';
import { Card, DataTable } from '../../../components/ui';
import { LoadError } from './StockIntro';

// Card + DataTable with the loading / empty / error states that Running Low,
// Not Selling and Stock History share.
export function StockTable({ columns, rows, rowKey, loading, error, onRetry, emptyState, onRowClick, footnote, below }) {
  return (
    <>
      {footnote && !loading && !error && (
        <div style={{ ...theme.type.footnote, ...theme.font.numeric, color: theme.colors.labelSecondary, marginBottom: theme.spacing.sm }}>{footnote}</div>
      )}
      <Card padding="0" style={{ overflow: 'hidden' }}>
        {error ? (
          <LoadError onRetry={onRetry} />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={rowKey} loading={loading} emptyState={emptyState} onRowClick={onRowClick} />
        )}
        {below}
      </Card>
    </>
  );
}

// Name in semibold with a footnote line under it.
export function TwoLine({ title, sub }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontWeight: theme.font.weightSemibold, color: theme.colors.label }}>{title}</div>
      {sub && <div style={{ ...theme.type.footnote, color: theme.colors.labelSecondary }}>{sub}</div>}
    </div>
  );
}
