import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokens, setUnauthorizedHandler } from '../lib/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => { tokens.admin = null; setUser(null); }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!tokens.admin) { setLoading(false); return; }
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => logout()).finally(() => setLoading(false));
  }, [logout]);

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password }, { token: null });
    tokens.admin = r.token;
    setUser(r.user);
    return r.user;
  };

  const refresh = async () => { const r = await api.get('/auth/me'); setUser(r.user); };

  const can = {
    write: user?.role === 'super_admin' || user?.role === 'admin',
    super: user?.role === 'super_admin',
  };

  return <AuthCtx.Provider value={{ user, loading, login, logout, refresh, can }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
