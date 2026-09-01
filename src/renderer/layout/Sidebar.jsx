import React, { useState } from 'react';
import {
  Circle,
  ChevronRight,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BookText,
  Receipt,
  Wallet,
  FileText,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Settings,
} from 'lucide-react';
import theme from '../config/theme';
import navConfig from '../config/navConfig';

// Explicit map (rather than `import * as` on lucide-react) so the bundle only
// pulls in the handful of icons navConfig actually references.
const ICONS = {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BookText,
  Receipt,
  Wallet,
  FileText,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Settings,
};

// Slightly lighter navy than the sidebar fill, used only for hairlines —
// not reused elsewhere, so it isn't promoted into theme.
const SIDEBAR_DIVIDER = '#2c4468';

// Fixed, steady width — the sidebar no longer collapses to an icon rail and
// expands on hover; it's always fully open. Kept as a named export so
// AdminDashboard.jsx's content area can size its margin-left to match.
export const SIDEBAR_WIDTH = '230px';

function Icon({ name, size = 17 }) {
  const Cmp = ICONS[name] || Circle;
  return <Cmp size={size} strokeWidth={1.75} />;
}

export default function Sidebar({ activeRoute, onNavigate, shopName, user, onLogout }) {
  // Which single parent group currently shows its children — purely a hover
  // state (not persisted): hovering a group opens it, moving the mouse off
  // that group's whole block (button + its open item list) closes it again.
  // No click needed and no click involved.
  const [expandedKey, setExpandedKey] = useState(null);

  function openSection(key) {
    setExpandedKey(key);
  }

  function closeSection(key) {
    setExpandedKey((current) => (current === key ? null : current));
  }

  // Customers, Suppliers, Users and Settings are hard-gated by role, not by the
  // flexible permission system — they must not render for a cashier even if
  // some permissionKey were granted. (Sidebar is currently only mounted for
  // admin anyway, but this keeps the component correct on its own if that
  // ever changes.)
  const ADMIN_ONLY_SECTIONS = new Set(['customers', 'suppliers', 'ledgers', 'users', 'settings']);
  const visibleSections = navConfig.filter((section) => !ADMIN_ONLY_SECTIONS.has(section.key) || user.role === 'admin');

  return (
    <div style={styles.container}>
      <div style={styles.brand}>
        <div style={styles.brandName}>{shopName || 'Stationery POS'}</div>
        <div style={styles.brandSub}>Admin Panel</div>
      </div>

      <nav style={styles.nav}>
        {visibleSections.map((section) => {
          const hasChildren = !!section.children;
          const isExpanded = expandedKey === section.key;
          const isDirectActive = !hasChildren && activeRoute === section.route;
          const isParentOfActive = hasChildren && section.children.some((c) => c.route === activeRoute);

          return (
            <div
              key={section.key}
              style={styles.sectionBlock}
              onMouseEnter={() => hasChildren && openSection(section.key)}
              onMouseLeave={() => hasChildren && closeSection(section.key)}
            >
              <button
                style={{
                  ...styles.sectionButton,
                  ...(isDirectActive || isParentOfActive ? styles.sectionButtonActive : {}),
                }}
                onClick={() => !hasChildren && onNavigate(section.route)}
                onMouseEnter={(e) => {
                  if (!isDirectActive && !isParentOfActive) e.currentTarget.style.backgroundColor = theme.colors.sidebarBackgroundActive;
                }}
                onMouseLeave={(e) => {
                  if (!isDirectActive && !isParentOfActive) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={styles.sectionIcon}>
                  <Icon name={section.icon} />
                </span>
                <span style={styles.sectionLabel}>{section.label}</span>
                {hasChildren && (
                  <span style={{ ...styles.chevron, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <ChevronRight size={15} strokeWidth={2} />
                  </span>
                )}
              </button>

              {hasChildren && isExpanded && (
                <div style={styles.itemList}>
                  {section.children.map((child) => {
                    const isActive = activeRoute === child.route;
                    return (
                      <button
                        key={child.key}
                        style={{ ...styles.itemButton, ...(isActive ? styles.itemButtonActive : {}) }}
                        onClick={() => onNavigate(child.route)}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.sidebarBackgroundActive;
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={styles.footer}>
        <div style={styles.avatar}>{(user.fullName || '?').charAt(0).toUpperCase()}</div>
        <div style={styles.footerInfo}>
          <div style={styles.footerName}>{user.fullName}</div>
          <span style={styles.roleBadge}>{user.role}</span>
        </div>
        <button style={styles.logoutButton} onClick={onLogout} title="Logout">
          <LogOut size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100vh',
    backgroundColor: theme.colors.sidebarBackground,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: theme.font.family,
    // Below the app's modal overlays (zIndex: 100, e.g. Record Payment) —
    // both are now `position: fixed`, so this keeps a modal reliably on top
    // instead of relying on DOM paint order between two fixed elements.
    zIndex: 40,
  },
  brand: { padding: '20px 18px', borderBottom: `1px solid ${SIDEBAR_DIVIDER}`, minHeight: '48px', boxSizing: 'border-box' },
  brandName: { color: theme.colors.textOnSidebarActive, fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold, whiteSpace: 'nowrap' },
  brandSub: { color: theme.colors.textOnSidebar, fontSize: theme.font.sizeXs, marginTop: '2px', whiteSpace: 'nowrap' },
  nav: { padding: '10px', flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 },
  sectionBlock: { marginBottom: '2px' },
  sectionButton: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textOnSidebar,
    fontSize: theme.font.sizeBase,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.15s ease',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
  },
  sectionButtonActive: { backgroundColor: theme.colors.sidebarBackgroundActive, color: theme.colors.textOnSidebarActive },
  sectionIcon: { display: 'flex', width: '18px', justifyContent: 'center', flexShrink: 0 },
  sectionLabel: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' },
  chevron: { display: 'inline-flex', transition: 'transform 0.15s ease', flexShrink: 0 },
  itemList: { display: 'flex', flexDirection: 'column', gap: '1px', paddingLeft: '34px', marginTop: '2px' },
  itemButton: {
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: theme.radius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textOnSidebar,
    fontSize: theme.font.sizeSm,
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    whiteSpace: 'nowrap',
  },
  itemButtonActive: { backgroundColor: theme.colors.sidebarBackgroundActive, color: theme.colors.textOnSidebarActive },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 16px',
    borderTop: `1px solid ${SIDEBAR_DIVIDER}`,
    flexShrink: 0,
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: theme.colors.sidebarBackgroundActive,
    color: theme.colors.textOnSidebarActive,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.font.sizeBase,
    fontWeight: theme.font.weightSemibold,
    flexShrink: 0,
  },
  footerInfo: { flex: 1, minWidth: 0 },
  footerName: {
    color: theme.colors.textOnSidebarActive,
    fontSize: theme.font.sizeSm,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  roleBadge: { color: theme.colors.textOnSidebar, fontSize: theme.font.sizeXs, textTransform: 'capitalize' },
  logoutButton: {
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textOnSidebar,
    cursor: 'pointer',
    padding: '6px',
    borderRadius: theme.radius.md,
    display: 'flex',
    flexShrink: 0,
  },
};
