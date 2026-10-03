import React, { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import theme from '../../config/theme';
import appIcons from '../../config/appIcons';
import glossary from '../../config/glossary';
import { Icon, IconTile } from '../../components/ui';
import useInteraction from '../../components/kit/useInteraction';
import { useNarrow } from './parts/reportUtils';

const c = theme.colors;
const g = glossary;

const REPORTS = [
  { route: '/reports/sales', title: g.salesReport, question: g.reportQuestion.sales, icon: appIcons.sales },
  { route: '/reports/profit-loss', title: g.profitLossReport, question: g.reportQuestion.profitLoss, icon: appIcons.reports },
  { route: '/reports/stock', title: g.stockReport, question: g.reportQuestion.stock, icon: appIcons.products },
  { route: '/reports/customers', title: g.customerStatements, question: g.reportQuestion.customers, icon: appIcons.customers },
  { route: '/reports/suppliers', title: g.supplierStatements, question: g.reportQuestion.suppliers, icon: appIcons.suppliers },
  { route: '/reports/cashiers', title: g.cashierPerformance, question: g.reportQuestion.cashiers, icon: appIcons.cashiers },
  { route: '/reports/expenses', title: g.expenseReport, question: g.reportQuestion.expenses, icon: appIcons.expenses },
];

// /reports — the Reports section's landing page: one card per report.
export default function ReportsHome({ onNavigate }) {
  const narrow = useNarrow();
  return (
    <div style={styles.page}>
      <p style={styles.intro}>{g.reportsIntro}</p>
      <div style={{ ...styles.grid, gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'repeat(2, minmax(0, 1fr))' }}>
        {REPORTS.map((r) => (
          <ReportCard key={r.route} report={r} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

const ReportCard = memo(function ReportCard({ report, onNavigate }) {
  const { hovered, pressed, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={() => onNavigate(report.route)}
      {...handlers}
      style={{
        ...styles.card,
        borderColor: hovered ? c.separatorStrong : c.separator,
        transform: pressed ? 'scale(0.99)' : 'none',
      }}
    >
      <IconTile {...report.icon} size="lg" />
      <span style={styles.text}>
        <span style={styles.title}>{report.title}</span>
        <span style={styles.question}>{report.question}</span>
      </span>
      <Icon icon={ChevronRight} size={18} style={{ color: c.labelTertiary }} />
    </button>
  );
});

const styles = {
  page: { display: 'flex', flexDirection: 'column', gap: theme.spacing.md, maxWidth: '1000px', paddingBottom: theme.spacing.xxl, fontFamily: theme.font.family },
  intro: { ...theme.type.body, color: c.labelSecondary, margin: 0 },
  grid: { display: 'grid', gap: theme.spacing.md },
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.smd,
    minWidth: 0,
    minHeight: '76px',
    padding: theme.spacing.md,
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    border: '1px solid',
    borderRadius: theme.radius.lg,
    fontFamily: theme.font.family,
    textAlign: 'left',
    cursor: 'pointer',
    transition: `border-color ${theme.motion.fast} ease, transform ${theme.motion.fast} ease`,
  },
  text: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  title: { ...theme.type.headline, color: c.label },
  question: { ...theme.type.subhead, color: c.labelSecondary },
};
