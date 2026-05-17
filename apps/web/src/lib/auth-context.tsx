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

import { SessionExpiredOverlay } from '@/components/session-expired-overlay';

import { ApiError, AuthUser, authApi, registerAuthBridge } from './api';

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  // True only after the initial silent-refresh attempt has finished.
  isReady: boolean;
  // True when a previously-active session was just invalidated (refresh failed).
  sessionExpired: boolean;
  dismissSessionExpired: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Per-tab marker; distinguishes "expired" from "never logged in".
const SESSION_MARK_KEY = 'auth-axion:had-session';
const markSession = () => {
  try {
    sessionStorage.setItem(SESSION_MARK_KEY, '1');
  } catch {}
};
const clearSessionMark = () => {
  try {
    sessionStorage.removeItem(SESSION_MARK_KEY);
  } catch {}
};
const hadSession = (): boolean => {
  try {
    return sessionStorage.getItem(SESSION_MARK_KEY) === '1';
  } catch {
    return false;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  const dismissSessionExpired = useCallback(() => setSessionExpired(false), []);

  // Prevents double-fire under React strict-mode.
  const didInit = useRef(false);
  // Sync mirror so the bridge can read the token outside render.
  const accessTokenRef = useRef<string | null>(null);
  // Coalesces concurrent refreshes to avoid reuse-detection.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const promise = (async () => {
      try {
        const result = await authApi.refresh();
        setAccessToken(result.accessToken);
        accessTokenRef.current = result.accessToken;
        return result.accessToken;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Overlay only if this tab actually had a session before.
          if (accessTokenRef.current !== null || hadSession()) {
            setSessionExpired(true);
          }
          clearSessionMark();
          setUser(null);
          setAccessToken(null);
          accessTokenRef.current = null;
        }
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    registerAuthBridge({
      getAccessToken: () => accessTokenRef.current,
      refresh,
    });
  }, [refresh]);

  // Silent refresh on mount: if a refresh-cookie exists, restore the session.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void (async () => {
      const token = await refresh();
      if (token) {
        try {
          const me = await authApi.me();
          setUser(me);
          markSession();
        } catch {
          // /me failed after a successful refresh — drop silently.
          setUser(null);
          setAccessToken(null);
          accessTokenRef.current = null;
        }
      }
      setIsReady(true);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await authApi.login({ email, password });
      setUser(result.user);
      setAccessToken(result.accessToken);
      accessTokenRef.current = result.accessToken;
      markSession();
      setSessionExpired(false);
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
      accessTokenRef.current = result.accessToken;
      markSession();
      setSessionExpired(false);
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
      accessTokenRef.current = null;
      clearSessionMark();
      setSessionExpired(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isReady,
      sessionExpired,
      dismissSessionExpired,
      login,
      register,
      logout,
      refresh,
    }),
    [
      user,
      accessToken,
      isLoading,
      isReady,
      sessionExpired,
      dismissSessionExpired,
      login,
      register,
      logout,
      refresh,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredOverlay open={sessionExpired} onDismiss={dismissSessionExpired} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
