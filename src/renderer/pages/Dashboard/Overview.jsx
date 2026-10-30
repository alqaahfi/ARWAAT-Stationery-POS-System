import React, { useCallback, useEffect, useState } from 'react';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Button } from '../../components/ui';
import { formatCount, formatCurrencyCompact } from '../../utils/format';
import { Panel } from './parts/Panel';
import GreetingHeader from './parts/GreetingHeader';
import GettingStartedCard from './parts/GettingStartedCard';
import StatTile from './parts/StatTile';
import RevenueChartCard from './parts/RevenueChartCard';
import NeedsAttentionCard from './parts/NeedsAttentionCard';
import RecentSalesCard from './parts/RecentSalesCard';
import QuickActionsCard from './parts/QuickActionsCard';
import SignedInCard from './parts/SignedInCard';
import BackupNotice from './parts/BackupNotice';

const c = theme.colors;
const NARROW_QUERY = '(max-width: 899px)';

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

// Admin Home. Loads once on mount (summary + sessions); the chart card loads
// its own trend per period. `onNavigate` drives every drill-in.
export default function Overview({ onNavigate }) {
  const narrow = useNarrow();
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(false);
  const [sessions, setSessions] = useState(null);

  const loadSummary = useCallback(() => {
    let alive = true;
    setSummaryError(false);
    setSummary(null);
    window.api.dashboard
      .getSummary()
      .then((res) => alive && setSummary(res || {}))
      .catch(() => alive && setSummaryError(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => loadSummary(), [loadSummary]);

  useEffect(() => {
    let alive = true;
    window.api.dashboard
      .getActiveSessions()
      .then((res) => alive && setSessions(Array.isArray(res) ? res : []))
      .catch(() => alive && setSessions([]));
    return () => {
      alive = false;
    };
  }, []);

  const loading = !summary;
  const s = summary || {};
  const salesCount = Number(s.todaySalesCount) || 0;
  const returnedToday = Number(s.todayReturns) || 0;
  const lowCount = Number(s.lowStockCount) || 0;

  const tiles = [
    {
      label: glossary.salesToday,
      ...appIcons.sell,
      value: formatCurrencyCompact(s.todaySalesTotal),
      footnote:
        (salesCount ? `${formatCount(salesCount)} ${salesCount === 1 ? 'sale' : 'sales'}` : 'No sales yet today') +
        (returnedToday > 0 ? ` · ${formatCurrencyCompact(returnedToday)} returned` : ''),
      route: '/reports/sales',
    },
    {
      label: glossary.customersOweYou,
      ...appIcons.accounts,
      value: formatCurrencyCompact(s.outstandingReceivables),
      footnote: 'Across all customers',
      route: '/ledgers',
    },
    {
      label: glossary.runningLow,
      ...appIcons.runningLow,
      value: formatCount(lowCount),
      footnote: lowCount ? 'Items to reorder' : 'All stocked up',
      footnoteColor: lowCount ? c.orangeText : undefined,
      route: '/products/low-stock',
    },
    {
      label: glossary.expensesThisMonth,
      ...appIcons.expenses,
      value: formatCurrencyCompact(s.monthExpenses),
      footnote: 'Since the 1st',
      route: '/expenses',
    },
  ];

  return (
    <div style={styles.page}>
      <GreetingHeader />

      {summaryError ? (
        <Panel>
          <div style={styles.error}>
            <span style={styles.errorText}>Couldn't load your shop's numbers.</span>
            <Button variant="tinted" size="sm" onClick={loadSummary}>
              Try again
            </Button>
          </div>
        </Panel>
      ) : (
        <>
          {summary && <GettingStartedCard summary={summary} onNavigate={onNavigate} />}
          {/* Rule 16: failed automatic backup / weekly "copy to USB" reminder. */}
          {summary && (
            <BackupNotice
              status={summary.autoBackup}
              onOpenSettings={() => onNavigate('/settings/backup')}
              onDone={() => window.api.backup.usbReminderDone().then(loadSummary).catch(() => {})}
            />
          )}
          <div style={{ ...styles.tiles, gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))' }}>
            {tiles.map((t) => (
              <StatTile key={t.route} {...t} loading={loading} onClick={() => onNavigate(t.route)} />
            ))}
          </div>
        </>
      )}

      <div style={{ ...styles.columns, gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 2fr) minmax(0, 1fr)' }}>
        <div style={styles.column}>
          <RevenueChartCard onNavigate={onNavigate} />
          {!summaryError && <RecentSalesCard sales={s.recentSales} loading={loading} onNavigate={onNavigate} />}
        </div>
        <div style={styles.column}>
          <NeedsAttentionCard onNavigate={onNavigate} />
          <QuickActionsCard onNavigate={onNavigate} />
          <SignedInCard sessions={sessions} />
        </div>
      </div>
    </div>
  );
}

const GAP = '20px';

const styles = {
  // Extra bottom room so the Dev Panel corner icon never covers the last card.
  page: { maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: GAP, paddingBottom: theme.spacing.xxl, fontFamily: theme.font.family },
  tiles: { display: 'grid', gap: GAP },
  columns: { display: 'grid', gap: GAP, alignItems: 'start' },
  column: { display: 'flex', flexDirection: 'column', gap: GAP, minWidth: 0 },
  error: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md, paddingTop: theme.spacing.smd },
  errorText: { ...theme.type.body, color: c.redText },
};
