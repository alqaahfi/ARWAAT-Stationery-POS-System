import React, { useState } from 'react';
import { Bell, ChevronLeft, Plus, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import theme from '../config/theme';
import appIcons from '../config/appIcons';
import glossary from '../config/glossary';
import { Badge, Icon, IconButton, Kbd, Menu, MenuItem, Popover } from '../components/ui';
import useInteraction from '../components/kit/useInteraction';
import { SyncChip } from './ShellParts';
import useAlerts, { ALERT_TYPES } from './useAlerts';

const c = theme.colors;

// The Admin app's top bar: back button + page title on the left; search
// trigger, sync chip, alerts and quick add on the right.
export default function TopUtilityBar({ title, back, onNavigate, onOpenSearch }) {
  const { user, hasPermission } = useAuth();
  const isAdmin = user.role === 'admin';

  return (
    <header style={styles.bar}>
      <div style={styles.left}>
        {back && <BackButton label={back.label} onClick={() => onNavigate(back.route)} />}
        <h1 style={styles.title}>{title}</h1>
      </div>

      <div style={styles.right}>
        {isAdmin && <SearchTrigger onClick={onOpenSearch} />}
        <SyncChip onNavigate={onNavigate} />
        {isAdmin && <AlertsBell onNavigate={onNavigate} />}
        {isAdmin && <QuickAdd onNavigate={onNavigate} hasPermission={hasPermission} />}
      </div>
    </header>
  );
}

function BackButton({ label, onClick }) {
  const { hovered, handlers } = useInteraction(false);
  return (
    <button type="button" onClick={onClick} {...handlers} style={{ ...styles.back, backgroundColor: hovered ? c.fill : 'transparent' }}>
      <Icon icon={ChevronLeft} size={18} />
      {label}
    </button>
  );
}

// Looks like a SearchField but only opens the palette.
function SearchTrigger({ onClick }) {
  const { hovered, handlers } = useInteraction(false);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Search (Ctrl+K)"
      {...handlers}
      style={{ ...styles.search, borderColor: hovered ? c.labelTertiary : c.separatorStrong }}
    >
      <Icon icon={Search} size={16} style={{ color: c.labelSecondary }} />
      <span style={styles.searchText}>Search</span>
      <span style={styles.kbds}>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

// ---------------- Alerts ----------------

function AlertsBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const counts = useAlerts();
  const rows = ALERT_TYPES.map((a) => ({ ...a, count: counts[a.key] })).filter((r) => r.count > 0);
  const total = counts.low + counts.dead + counts.overdue;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={300}
      anchor={
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconButton icon={Bell} label="Alerts" onClick={() => setOpen((o) => !o)} aria-expanded={open} />
          {total > 0 && <span style={styles.count}>{total > 99 ? '99+' : total}</span>}
        </span>
      }
    >
      {(close) =>
        rows.length ? (
          <Menu label="Alerts">
            {rows.map((r) => (
              <MenuItem
                key={r.key}
                icon={r.icon}
                color={r.color}
                label={r.label}
                badge={<Badge tone={r.tone} size="sm">{r.count}</Badge>}
                onClick={() => {
                  close();
                  onNavigate(r.route);
                }}
              />
            ))}
          </Menu>
        ) : (
          <div style={styles.empty}>No alerts right now.</div>
        )
      }
    </Popover>
  );
}

// ---------------- Quick Add ----------------

// Same destinations and gates as before: products/customers/suppliers are
// admin (this bar only shows them to admin); expenses needs manage_expenses.
const QUICK_ADD_ITEMS = [
  { label: glossary.addProduct, route: '/products/new', ...appIcons.products },
  { label: glossary.addCustomer, route: '/customers/new', ...appIcons.customers },
  { label: glossary.addSupplier, route: '/suppliers/new', ...appIcons.suppliers },
  { label: glossary.addExpense, route: '/expenses/new', ...appIcons.expenses, permissionKey: 'manage_expenses' },
];

function QuickAdd({ onNavigate, hasPermission }) {
  const [open, setOpen] = useState(false);
  const items = QUICK_ADD_ITEMS.filter((i) => !i.permissionKey || hasPermission(i.permissionKey));
  if (!items.length) return null;

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      width={220}
      anchor={<IconButton icon={Plus} label="Quick Add" onClick={() => setOpen((o) => !o)} aria-expanded={open} />}
    >
      {(close) => (
        <Menu label="Quick Add">
          {items.map((i) => (
            <MenuItem
              key={i.route}
              icon={i.icon}
              color={i.color}
              label={i.label}
              onClick={() => {
                close();
                onNavigate(i.route);
              }}
            />
          ))}
        </Menu>
      )}
    </Popover>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    height: '56px',
    minHeight: '56px',
    padding: '0 20px 0 24px',
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    borderBottom: `1px solid ${c.separator}`,
    fontFamily: theme.font.family,
    flexShrink: 0,
  },
  left: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  title: { ...theme.type.title1, color: c.label, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  right: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexShrink: 0 },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    height: theme.control.sm,
    padding: '0 8px 0 4px',
    marginLeft: '-8px',
    border: 'none',
    borderRadius: theme.radius.sm,
    color: c.accent,
    fontFamily: theme.font.family,
    ...theme.type.body,
    fontWeight: theme.font.weightMedium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: `background-color ${theme.motion.fast} ease`,
  },
  search: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '260px',
    height: theme.control.md,
    padding: '0 8px 0 10px',
    boxSizing: 'border-box',
    border: '1px solid',
    borderRadius: theme.radius.md,
    backgroundColor: c.surface,
    fontFamily: theme.font.family,
    cursor: 'text',
    transition: `border-color ${theme.motion.fast} ease`,
  },
  searchText: { ...theme.type.body, color: c.labelTertiary, flex: 1, textAlign: 'left' },
  kbds: { display: 'inline-flex', gap: '3px' },
  count: {
    position: 'absolute',
    top: '1px',
    right: '1px',
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
    boxSizing: 'border-box',
    borderRadius: theme.radius.pill,
    backgroundColor: c.red,
    color: c.labelOnAccent,
    ...theme.type.caption,
    fontWeight: theme.font.weightSemibold,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    pointerEvents: 'none',
  },
  empty: { ...theme.type.subhead, color: c.labelSecondary, padding: '12px', textAlign: 'center' },
};
