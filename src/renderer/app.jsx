import React, { useEffect, useState } from 'react';
import theme from './config/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Setup from './pages/Setup/Setup';
import SetupShell from './pages/Setup/SetupShell';
import { Button } from './components/ui';
import CashierInitialSync from './pages/Setup/CashierInitialSync';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import DevPanelTrigger from './components/DevPanelTrigger';
import ClockWarningBanner from './components/ClockWarningBanner';

// Which app this window is (Admin or Cashier shortcut). Both run in one
// process; the main process decides what each may do, this only picks screens.
const APP_MODE = window.api.app?.mode === 'cashier' ? 'cashier' : 'admin';

function AppRouter() {
  const { user, loading, login } = useAuth();
  const [setupStatus, setSetupStatus] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);
  // Set the instant a counter PC finishes Setup, cleared once its forced first
  // sync succeeds — a one-time UI gate, so a normal later restart of an
  // already-synced counter PC never re-shows it. Holds the login just typed so
  // the person lands in the POS without typing it again.
  const [pendingCashierSync, setPendingCashierSync] = useState(null);

  useEffect(() => {
    refreshSetup();
  }, []);

  function refreshSetup() {
    setCheckingSetup(true);
    return window.api.setup.getStatus().then((status) => {
      setSetupStatus(status);
      setCheckingSetup(false);
    });
  }

  async function handleSetupDone({ role, username, password }) {
    if (role === 'cashier') {
      setPendingCashierSync({ username, password });
      await refreshSetup();
      return;
    }
    await refreshSetup();
    // Admin set up from the Admin window: straight into the dashboard. From the
    // Cashier window, open the Admin window to sign in there.
    if (APP_MODE === 'admin') await login(username, password);
    else window.api.app.openWindow({ mode: 'admin' });
  }

  async function handleCashierSyncDone() {
    const { username, password } = pendingCashierSync;
    setPendingCashierSync(null);
    // A counter PC set up from the Admin window hands over to the Cashier window.
    if (APP_MODE === 'admin') window.api.app.openWindow({ mode: 'cashier', closeThis: true });
    else await login(username, password);
  }

  if (checkingSetup || loading) return <CenteredMessage text="Loading..." />;

  if (!setupStatus.configured) return <Setup onDone={handleSetupDone} />;

  if (pendingCashierSync) return <CashierInitialSync onDone={handleCashierSyncDone} />;

  if (APP_MODE === 'admin' && setupStatus.role === 'cashier') return <CounterComputer />;

  if (!user) return <Login mode={APP_MODE} />;

  return <Dashboard />;
}

// The Admin shortcut opened on a counter PC: nothing to sign in to here.
function CounterComputer() {
  return (
    <SetupShell
      title="This is a counter computer"
      subtitle="The Admin app runs on the main computer."
      footer={
        <Button size="lg" fullWidth onClick={() => window.api.app.openWindow({ mode: 'cashier', closeThis: true })}>
          Open Cashier
        </Button>
      }
    />
  );
}

function CenteredMessage({ text }) {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.appBackground,
        color: theme.colors.textSecondary,
        fontFamily: theme.font.family,
      }}
    >
      {text}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
      {/* True root, outside the router: renders on Setup and Login too, not
          just inside the authenticated Sidebar layout. */}
      <DevPanelTrigger />
      {/* Rule 15: wrong computer clock warning, in both windows. */}
      <ClockWarningBanner />
    </AuthProvider>
  );
}