import React from 'react';
import theme from '../config/theme';
import appIcons from '../config/appIcons';
import glossary from '../config/glossary';
import { APP_NAME } from '../config/appInfo';
import { NAV_GROUPS, getSectionForRoute, sectionEntryRoute, visibleSections } from '../config/navConfig';
import { useAuth } from '../context/AuthContext';
import { Button, IconTile } from '../components/ui';
import useInteraction from '../components/kit/useInteraction';
import { Brand, UserChip } from './ShellParts';

const c = theme.colors;

// Fixed width, always open (no collapse). Exported for the shell layout.
export const SIDEBAR_WIDTH = '232px';

export default function Sidebar({ activeRoute, onNavigate, user, onLogout }) {
  const { hasPermission } = useAuth();
  const sections = visibleSections(user, hasPermission);
  const activeKey = getSectionForRoute(activeRoute)?.section.key;
  const canSell = hasPermission('make_sale');

  const ungrouped = sections.filter((s) => !s.group);
  const groups = NAV_GROUPS.map((name) => [name, sections.filter((s) => s.group === name)]).filter(([, list]) => list.length);

  function item(s) {
    return (
      <NavItem
        key={s.key}
        section={s}
        selected={s.key === activeKey}
        onClick={() => onNavigate(sectionEntryRoute(s, user, hasPermission))}
      />
    );
  }

  return (
    <aside style={styles.container}>
      <div style={styles.top}>
        <Brand name={APP_NAME} />
        {canSell && (
          <Button icon={appIcons.sell.icon} fullWidth onClick={() => onNavigate('/pos')} style={{ marginTop: theme.spacing.md }}>
            {glossary.newSale}
          </Button>
        )}
      </div>

      <nav aria-label="Main" style={styles.nav}>
        {ungrouped.map(item)}
        {groups.map(([name, list]) => (
          <div key={name}>
            <div style={styles.groupHeader}>{name}</div>
            {list.map(item)}
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <UserChip user={user} onLogout={onLogout} />
      </div>
    </aside>
  );
}

function NavItem({ section, selected, onClick }) {
  const { hovered, handlers } = useInteraction(false);
  const icon = appIcons[section.icon] || appIcons.home;
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      {...handlers}
      style={{
        ...styles.item,
        backgroundColor: selected ? c.accentTint : hovered ? c.fill : 'transparent',
        color: selected ? c.accent : c.label,
        fontWeight: selected ? theme.font.weightSemibold : theme.font.weightMedium,
      }}
    >
      <IconTile icon={icon.icon} color={icon.color} size="sm" />
      <span style={styles.itemLabel}>{section.label}</span>
    </button>
  );
}

const styles = {
  container: {
    width: SIDEBAR_WIDTH,
    height: '100vh',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    backgroundColor: c.sidebarBackground,
    borderRight: `1px solid ${c.separator}`,
    fontFamily: theme.font.family,
  },
  top: { padding: '18px 14px 12px' },
  nav: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '4px 10px 12px' },
  groupHeader: {
    ...theme.type.footnote,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: c.labelSecondary,
    padding: '16px 8px 6px',
  },
  item: {
    width: '100%',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 8px',
    marginBottom: '2px',
    boxSizing: 'border-box',
    border: 'none',
    borderRadius: theme.radius.md,
    fontFamily: theme.font.family,
    fontSize: theme.type.body.fontSize,
    textAlign: 'left',
    cursor: 'pointer',
    transition: `background-color ${theme.motion.fast} ease`,
  },
  itemLabel: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  footer: { padding: '12px 14px', borderTop: `1px solid ${c.separator}` },
};
