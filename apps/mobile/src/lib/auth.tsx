import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchMe,
  fetchMyPermissions,
  login as apiLogin,
  logout as apiLogout,
  type AuthUser,
} from './api';
import { userHasAnyRole } from './roleCatalog';
import { clearTokens, getAccessToken } from './storage';

type AuthContextValue = {
  user: AuthUser | null;
  permissions: string[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (code: string) => boolean;
  hasRole: (code: string) => boolean;
  refreshPermissions: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const me = await fetchMe();
    const { permissions: perms } = await fetchMyPermissions();
    setUser(me);
    setPermissions(perms);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = await getAccessToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        await loadSession();
      } catch {
        await clearTokens();
        if (!cancelled) {
          setUser(null);
          setPermissions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadSession]);

  const login = useCallback(
    async (email: string, password: string) => {
      await apiLogin(email, password);
      await loadSession();
    },
    [loadSession],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setPermissions([]);
  }, []);

  const refreshPermissions = useCallback(async () => {
    const { permissions: perms } = await fetchMyPermissions();
    setPermissions(perms);
    const me = await fetchMe();
    setUser(me);
  }, []);

  const can = useCallback((code: string) => permissions.includes(code), [permissions]);

  const hasRole = useCallback(
    (code: string) => userHasAnyRole(user?.roles, [code]),
    [user],
  );

  const value = useMemo(
    () => ({
      user,
      permissions,
      loading,
      login,
      logout,
      can,
      hasRole,
      refreshPermissions,
    }),
    [user, permissions, loading, login, logout, can, hasRole, refreshPermissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
