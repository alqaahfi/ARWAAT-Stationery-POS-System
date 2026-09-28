import React, { useEffect, useState } from 'react';
import theme from './config/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import ChooseRole from './pages/Setup/ChooseRole';
import SetupAdmin from './pages/Setup/SetupAdmin';
import SetupCashier from './pages/Setup/SetupCashier';
import CashierInitialSync from './pages/Setup/CashierInitialSync';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import DevPanelTrigger from './components/DevPanelTrigger';

function AppRouter() {
  const { user, loading } = useAuth();
  const [activationStatus, setActivationStatus] = useState(null);
  // True when license_activation exists for an admin PC but no user account
  // has been created yet — e.g. the app was closed/crashed/restarted between
  // the key-activation step and the create-admin-account step. Without this,
  // activationStatus.activated alone would send the app straight to Login
  // with no account able to ever log in, stranding whoever set it up.
  const [needsAdminAccount, setNeedsAdminAccount] = useState(false);
  const [setupView, setSetupView] = useState('choose');
  const [checkingActivation, setCheckingActivation] = useState(true);
  // Set the instant SetupCashier.jsx finishes, cleared once its forced first
  // sync succeeds — a one-time UI gate, not part of activationStatus itself,
  // so a normal later restart of an already-synced Cashier PC never re-shows
  // it (see Step 6 of the sync design doc).
  const [pendingCashierSync, setPendingCashierSync] = useState(false);

  useEffect(() => {
    refreshActivation();
  }, []);

  function refreshActivation() {
    setCheckingActivation(true);
    Promise.all([window.api.license.getStatus(), window.api.users.hasAdminUser()]).then(([status, hasAdminUser]) => {
      setActivationStatus(status);
      setNeedsAdminAccount(Boolean(status.activated) && status.role === 'admin' && !hasAdminUser);
      setCheckingActivation(false);
    });
  }

  if (checkingActivation || loading) return <CenteredMessage text="Loading..." />;

  if (!activationStatus.activated) {
    if (setupView === 'admin') {
      return <SetupAdmin onBack={() => setSetupView('choose')} onActivated={refreshActivation} />;
    }
    if (setupView === 'cashier') {
      return (
        <SetupCashier
          onBack={() => setSetupView('choose')}
          onActivated={() => {
            setPendingCashierSync(true);
            refreshActivation();
          }}
        />
      );
    }
    return <ChooseRole onChoose={(role) => setSetupView(role)} />;
  }

  if (needsAdminAccount) {
    return <SetupAdmin onActivated={refreshActivation} resumeCreateAccount />;
  }

  if (pendingCashierSync) {
    return <CashierInitialSync onDone={() => setPendingCashierSync(false)} />;
  }

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