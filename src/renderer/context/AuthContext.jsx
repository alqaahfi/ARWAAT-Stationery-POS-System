import React, { createContext, useContext, useState, useEffect } from 'react';
import { loadCurrencySymbol } from '../utils/format';
import { SESSION_ENDED_EVENT } from '../utils/appEvents';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('pos_session_token');
    if (!savedToken) {
      setLoading(false);
      return;
    }
    window.api.users.validateSession({ token: savedToken }).then(async (res) => {
      if (res.valid) {
        setUser(res.user);
        setToken(savedToken);
        await loadPermissions(res.user.id);
        await loadCurrencySymbol();
      } else {
        localStorage.removeItem('pos_session_token');
      }
      setLoading(false);
    });
  }, []);

  // The main process ended this window's session (expired, revoked, or the
  // account was deactivated): drop it locally and show Login again.
  useEffect(() => {
    function onSessionEnded() {
      window.dispatchEvent(new Event('pos:before-logout'));
      setUser(null);
      setToken(null);
      setPermissions({});
      localStorage.removeItem('pos_session_token');
      localStorage.removeItem('pos_locked_user'); // signing in again proves the password
    }
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    return () => window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
  }, []);

  async function loadPermissions(userId) {
    const perms = await window.api.users.getPermissions({ userId });
    setPermissions(perms || {});
  }

  async function login(username, password) {
    const res = await window.api.users.login({ username, password });
    if (res.success) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('pos_session_token', res.token);
      await loadPermissions(res.user.id);
      await loadCurrencySymbol();
    }
    return res;
  }

  async function logout() {
    window.dispatchEvent(new Event('pos:before-logout'));
    if (token) await window.api.users.logout({ token });
    setUser(null);
    setToken(null);
    setPermissions({});
    localStorage.removeItem('pos_session_token');
  }

  // Admin implicitly has every permission — cashiers need an explicit
  // user_permissions row. hasPermission checks existence (a granted boolean
  // flag); getPermissionValue reads the associated value (e.g. a numeric cap).
  function hasPermission(key) {
    if (user?.role === 'admin') return true;
    return Object.prototype.hasOwnProperty.call(permissions, key);
  }

  function getPermissionValue(key) {
    if (user?.role === 'admin') return undefined;
    return permissions[key];
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, permissions, login, logout, hasPermission, getPermissionValue }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
