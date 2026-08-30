import React, { createContext, useContext, useState, useEffect } from 'react';

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
      } else {
        localStorage.removeItem('pos_session_token');
      }
      setLoading(false);
    });
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
    }
    return res;
  }

  async function logout() {
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
