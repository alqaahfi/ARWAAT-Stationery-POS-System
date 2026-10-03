import React from 'react';
import { Info, CircleAlert } from 'lucide-react';
import theme from '../../../config/theme';
import appIcons from '../../../config/appIcons';
import { Button, Card, EmptyState, Icon, Skeleton } from '../../../components/ui';

const c = theme.colors;

// The common frame every report renders inside:
// intro · filter card (filters left, export right) · summary · content · footnotes.
export default function ReportShell({
  intro,
  filters,
  exportAction,
  summary,
  children,
  footnotes = [],
  loading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyHint = 'Nothing to show for this period. Try a wider date range.',
}) {
  let body;
  if (error) {
    body = (
      <Card>
        <div role="alert" style={styles.error}>
          <span style={styles.errorText}>
            <Icon icon={CircleAlert} size={18} />
            {error}
          </span>
          {onRetry && (
            <Button variant="tinted" size="sm" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      </Card>
    );
  } else if (loading) {
    body = (
      <>
        <div style={styles.skeletonRow}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <Skeleton width="50%" height="12px" />
              <Skeleton width="70%" height="28px" style={{ marginTop: '12px' }} />
            </Card>
          ))}
        </div>
        <Card>
          <Skeleton height="220px" radius={theme.radius.md} />
        </Card>
        <Card>
          <Skeleton lines={5} />
        </Card>
      </>
    );
  } else if (isEmpty) {
    body = (
      <Card>
        <EmptyState {...appIcons.reports} title="Nothing here yet" message={emptyHint} />
      </Card>
    );
  } else {
    body = (
      <>
        {summary}
        {children}
      </>
    );
  }

  return (
    <div style={styles.page}>
      {intro && <p style={styles.intro}>{intro}</p>}

      {(filters || exportAction) && (
        <Card padding={theme.spacing.smd}>
          <div style={styles.filterRow}>
            <div style={styles.filters}>{filters}</div>
            {exportAction && <div style={styles.export}>{exportAction}</div>}
          </div>
        </Card>
      )}

      {body}

      {footnotes.filter(Boolean).length > 0 && (
        <div style={styles.footnotes}>
          {footnotes.filter(Boolean).map((note) => (
            <div key={note} style={styles.footnote}>
              <Icon icon={Info} size={14} style={{ marginTop: '1px' }} />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  // Extra bottom room so the Dev Panel corner icon never covers content.
  page: { display: 'flex', flexDirection: 'column', gap: theme.spacing.md, paddingBottom: theme.spacing.xxl, fontFamily: theme.font.family, minWidth: 0 },
  intro: { ...theme.type.body, color: c.labelSecondary, margin: 0 },
  filterRow: { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: theme.spacing.md, flexWrap: 'wrap' },
  filters: { display: 'flex', alignItems: 'flex-end', gap: theme.spacing.smd, flexWrap: 'wrap', minWidth: 0 },
  export: { flexShrink: 0, marginLeft: 'auto' },
  error: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  errorText: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, ...theme.type.body, color: c.redText },
  skeletonRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing.md },
  footnotes: { display: 'flex', flexDirection: 'column', gap: '6px' },
  footnote: { display: 'flex', alignItems: 'flex-start', gap: '6px', ...theme.type.footnote, color: c.labelSecondary },
};
