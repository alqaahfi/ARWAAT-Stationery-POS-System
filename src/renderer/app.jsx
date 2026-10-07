import React, { useEffect, useState } from 'react';
import theme from './config/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import Setup from './pages/Setup/Setup';
import CashierInitialSync from './pages/Setup/CashierInitialSync';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import DevPanelTrigger from './components/DevPanelTrigger';

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
    // Admin: straight into the dashboard.
    await refreshSetup();
    await login(username, password);
  }

  async function handleCashierSyncDone() {
    const { username, password } = pendingCashierSync;
    setPendingCashierSync(null);
    await login(username, password);
  }

  if (checkingSetup || loading) return <CenteredMessage text="Loading..." />;

  if (!setupStatus.configured) return <Setup onDone={handleSetupDone} />;

  if (pendingCashierSync) return <CashierInitialSync onDone={handleCashierSyncDone} />;

  if (!user) return <Login />;

  return <Dashboard />;
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
    </AuthProvider>
  );
}