import React, { useEffect, useState } from 'react';
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
  Receipt,
  Wallet,
  FileText,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Settings,
};

// Slightly lighter navy than the sidebar fill, used only for the one hairline
// separating the nav list from the user/logout footer — not reused elsewhere,
// so it isn't promoted into the shared theme.
const SIDEBAR_DIVIDER = '#2c4468';

const EXPANDED_STORAGE_KEY = 'pos_sidebar_expanded_keys';

function loadExpanded() {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveExpanded(set) {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage unavailable (e.g. private/blocked) — expansion just won't persist.
  }
}

function Icon({ name, size = 17 }) {
  const Cmp = ICONS[name] || Circle;
  return <Cmp size={size} strokeWidth={1.75} />;
}

export default function Sidebar({ activeRoute, onNavigate, shopName, user, onLogout }) {
  const [expanded, setExpanded] = useState(loadExpanded);

  useEffect(() => {
    saveExpanded(expanded);
  }, [expanded]);

  function toggleSection(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Customers, Suppliers and Users are hard-gated by role, not by the
  // flexible permission system — they must not render for a cashier even if
  // some permissionKey were granted. (Sidebar is currently only mounted for
  // admin anyway, but this keeps the component correct on its own if that
  // ever changes.)
  const ADMIN_ONLY_SECTIONS = new Set(['customers', 'suppliers', 'users']);
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
          const isExpanded = expanded.has(section.key);
          const isDirectActive = !hasChildren && activeRoute === section.route;
          const isParentOfActive = hasChildren && section.children.some((c) => c.route === activeRoute);

          return (
            <div key={section.key} style={styles.sectionBlock}>
              <button
                style={{
                  ...styles.sectionButton,
                  ...(isDirectActive || isParentOfActive ? styles.sectionButtonActive : {}),
                }}
                onClick={() => (hasChildren ? toggleSection(section.key) : onNavigate(section.route))}
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
    width: '230px',
    minWidth: '230px',
    height: '100vh',
    backgroundColor: theme.colors.sidebarBackground,
    display: 'flex',
    flexDirection: 'column',
    fontFamily: theme.font.family,
  },
  brand: { padding: '20px 18px', borderBottom: `1px solid ${SIDEBAR_DIVIDER}` },
  brandName: { color: theme.colors.textOnSidebarActive, fontSize: theme.font.sizeMd, fontWeight: theme.font.weightSemibold },
  brandSub: { color: theme.colors.textOnSidebar, fontSize: theme.font.sizeXs, marginTop: '2px' },
  nav: { padding: '10px', flex: 1, overflowY: 'auto', minHeight: 0 },
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
  },
  sectionButtonActive: { backgroundColor: theme.colors.sidebarBackgroundActive, color: theme.colors.textOnSidebarActive },
  sectionIcon: { display: 'flex', width: '18px', justifyContent: 'center', flexShrink: 0 },
  sectionLabel: { flex: 1 },
  chevron: { display: 'inline-flex', transition: 'transform 0.15s ease' },
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
