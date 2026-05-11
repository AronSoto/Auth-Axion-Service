'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiError, AuthUser, authApi } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  // True only after the initial silent-refresh attempt has finished.
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  // Refreshes silently — used by API consumers and on mount.
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Avoid double-firing the silent refresh on React strict-mode mount.
  const didInit = useRef(false);

  const applySession = useCallback(async (token: string) => {
    setAccessToken(token);
    const me = await authApi.me(token);
    setUser(me);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const result = await authApi.refresh();
      await applySession(result.accessToken);
      return result.accessToken;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setAccessToken(null);
      }
      return null;
    }
  }, [applySession]);

  // Silent refresh on mount: if a refresh-cookie exists, restore the session.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void refresh().finally(() => setIsReady(true));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login({ email, password });
      setUser(result.user);
      setAccessToken(result.accessToken);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.register({ email, password, name });
      setUser(result.user);
      setAccessToken(result.accessToken);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setAccessToken(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, accessToken, isLoading, isReady, login, register, logout, refresh }),
    [user, accessToken, isLoading, isReady, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
