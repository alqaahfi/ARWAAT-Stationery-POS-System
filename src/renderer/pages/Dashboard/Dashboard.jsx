import React, { useLayoutEffect, useRef, useState } from 'react';
import { restoreScroll } from '../../utils/scrollRestore';
import { ChevronLeft, Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import { isPosSaleInProgress } from '../POS/Sale';
import CashierRoutes, { CASHIER_MENU, cashierRouteTitle } from './CashierRoutes';
import theme from '../../config/theme';
import glossary from '../../config/glossary';
import { APP_NAME } from '../../config/appInfo';
import { Button, Menu, MenuItem, Popover } from '../../components/ui';
import { Brand, SyncChip, UserChip } from '../../layout/ShellParts';
import { HeaderClock, LockButton, LockProvider } from '../../layout/LockScreen';

export default function Dashboard() {
  const { user } = useAuth();
  return <LockProvider>{user.role === 'admin' ? <AdminDashboard /> : <CashierLayout />}</LockProvider>;
}

// POS-first layout: no sidebar or tabs. New Sale is home; a Menu in the
// header reaches whatever other pages this cashier's permissions allow.
function CashierLayout() {
  const { user, logout, hasPermission } = useAuth();
  const [nav, setNav] = useState({ route: '/pos', params: {} });
  const [menuOpen, setMenuOpen] = useState(false);

  // Same leave-mid-sale guard as AdminDashboard's navigate().
  function navigate(route, params = {}) {
    if (nav.route === '/pos' && route !== '/pos' && isPosSaleInProgress()) {
      const proceed = window.confirm("You have an unfinished sale — leave anyway? It'll be saved as a draft.");
      if (!proceed) return;
    }
    // Coming back to a page from one of its detail pages restores its scroll position.
    scrollMemory.current[nav.route] = mainRef.current?.scrollTop || 0;
    restoreTarget.current = nav.route !== '/pos' && route !== '/pos' ? scrollMemory.current[route] || 0 : 0;
    setNav({ route, params });
  }

  const mainRef = useRef(null);
  const scrollMemory = useRef({});
  const restoreTarget = useRef(0);
  useLayoutEffect(() => {
    const top = restoreTarget.current;
    restoreTarget.current = 0;
    if (!top) return undefined;
    return restoreScroll(mainRef.current, top);
  }, [nav.route]);

  const menuItems = CASHIER_MENU.filter((m) => hasPermission(m.permissionKey));
  const showMenu = menuItems.some((m) => m.route !== '/pos');
  const onPos = nav.route === '/pos';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.left}>
          {onPos ? (
            <Brand name={APP_NAME} />
          ) : (
            <>
              <Button variant="plain" size="sm" icon={ChevronLeft} onClick={() => navigate('/pos')} style={{ paddingLeft: '4px' }}>
                {glossary.newSale}
              </Button>
              <h1 style={styles.title}>{cashierRouteTitle(nav.route)}</h1>
            </>
          )}
        </div>
        <div style={styles.right}>
          {showMenu && (
            <Popover
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              width={240}
              anchor={
                <Button
                  variant="secondary"
                  icon={MenuIcon}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((o) => !o)}
                >
                  {glossary.menu}
                </Button>
              }
            >
              {(close) => (
                <Menu label={glossary.menu}>
                  {menuItems.map((m) => (
                    <MenuItem
                      key={m.route}
                      icon={m.icon}
                      color={m.color}
                      label={m.label}
                      aria-current={nav.route === m.route ? 'page' : undefined}
                      onClick={() => {
                        close(false);
                        navigate(m.route);
                      }}
                    />
                  ))}
                </Menu>
              )}
            </Popover>
          )}
          <HeaderClock />
          <LockButton />
          <SyncChip />
          <div style={styles.divider} />
          <UserChip user={user} onLogout={logout} style={{ width: '200px' }} />
        </div>
      </header>

      {onPos ? (
        <main style={styles.posContent}>
          <CashierRoutes route={nav.route} params={nav.params} onNavigate={navigate} />
        </main>
      ) : (
        <main ref={mainRef} style={styles.content}>
          <div style={styles.page}>
            <CashierRoutes route={nav.route} params={nav.params} onNavigate={navigate} />
          </div>
        </main>
      )}
    </div>
  );
}

const c = theme.colors;

const styles = {
  container: { height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: c.bg, color: c.label, fontFamily: theme.font.family },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: '0 20px 0 24px',
    height: '56px',
    minHeight: '56px',
    boxSizing: 'border-box',
    backgroundColor: c.surface,
    borderBottom: `1px solid ${c.separator}`,
    flexShrink: 0,
  },
  left: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  title: { ...theme.type.title2, color: c.label, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  right: { display: 'flex', alignItems: 'center', gap: theme.spacing.smd, flexShrink: 0 },
  divider: { width: '1px', height: '24px', backgroundColor: c.separator },
  content: { flex: 1, minHeight: 0, padding: theme.spacing.lg, overflowY: 'auto' },
  page: { maxWidth: '1200px', margin: '0 auto' },
  // New Sale fills the region itself; only its own lists scroll.
  posContent: { flex: 1, minHeight: 0, padding: theme.spacing.md, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
};
