import React, { useEffect, useState } from 'react';
import theme from './config/theme';
import { AuthProvider, useAuth } from './context/AuthContext';
import ChooseRole from './pages/Setup/ChooseRole';
import SetupAdmin from './pages/Setup/SetupAdmin';
import SetupCashier from './pages/Setup/SetupCashier';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import DevPanelTrigger from './components/DevPanelTrigger';

function AppRouter() {
  const { user, loading } = useAuth();
  const [activationStatus, setActivationStatus] = useState(null);
  const [setupView, setSetupView] = useState('choose');
  const [checkingActivation, setCheckingActivation] = useState(true);

  useEffect(() => {
    refreshActivation();
  }, []);

  function refreshActivation() {
    setCheckingActivation(true);
    window.api.license.getStatus().then((res) => {
      setActivationStatus(res);
      setCheckingActivation(false);
    });
  }

  if (checkingActivation || loading) return <CenteredMessage text="Loading..." />;

  if (!activationStatus.activated) {
    if (setupView === 'admin') {
      return <SetupAdmin onBack={() => setSetupView('choose')} onActivated={refreshActivation} />;
    }
    if (setupView === 'cashier') {
      return <SetupCashier onBack={() => setSetupView('choose')} onActivated={refreshActivation} />;
    }
    return <ChooseRole onChoose={(role) => setSetupView(role)} />;
  }

  if (!user) return <Login />;

  return <Dashboard shopName={activationStatus.shopName} />;
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