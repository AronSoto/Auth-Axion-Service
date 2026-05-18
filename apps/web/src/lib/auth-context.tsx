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
import { ApiError, UserProfile, authApi, registerAuthBridge } from './api';

export type SessionEndReason = 'expired' | 'signedOut';

interface AuthContextValue {
  user: UserProfile | null;
  accessToken: string | null;
  isLoading: boolean;
  // True only after the initial silent-refresh attempt has finished.
  isReady: boolean;
  // Non-null when a previously-active session was just invalidated. The
  // overlay reads `reason` to pick the right copy.
  sessionEndedReason: SessionEndReason | null;
  dismissSessionEnded: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  // Refresh the access token AND load the full profile. Used by the OAuth
  // callback page, which only has a refresh cookie when it lands.
  hydrate: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Per-tab marker; distinguishes "expired" from "never logged in".
const SESSION_MARK_KEY = 'auth-axion:had-session';
const BROADCAST_CHANNEL = 'auth-axion:auth';
type AuthBroadcast = { type: 'logout' };
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
  const [user, setUser] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionEndedReason, setSessionEndedReason] = useState<SessionEndReason | null>(null);

  const dismissSessionEnded = useCallback(() => setSessionEndedReason(null), []);

  // Prevents double-fire under React strict-mode.
  const didInit = useRef(false);
  // Sync mirror so the bridge can read the token outside render.
  const accessTokenRef = useRef<string | null>(null);
  // Coalesces concurrent refreshes to avoid reuse-detection.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  // Cross-tab logout channel.
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const clearLocalSession = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    accessTokenRef.current = null;
    clearSessionMark();
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const promise = (async () => {
      try {
        const result = await authApi.refresh();
        setAccessToken(result.accessToken);
        accessTokenRef.current = result.accessToken;
        markSession();
        return result.accessToken;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Overlay only if this tab actually had a session before.
          if (accessTokenRef.current !== null || hadSession()) {
            setSessionEndedReason('expired');
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

  const hydrate = useCallback(async (): Promise<UserProfile | null> => {
    const token = await refresh();
    if (!token) return null;
    try {
      const profile = await authApi.me();
      setUser(profile);
      markSession();
      return profile;
    } catch {
      // /me failed after a successful refresh — drop silently.
      clearLocalSession();
      return null;
    }
  }, [refresh, clearLocalSession]);

  useEffect(() => {
    registerAuthBridge({
      getAccessToken: () => accessTokenRef.current,
      refresh,
    });
  }, [refresh]);

  // Listen for cross-tab logouts. Other tabs will surface the session-expired overlay.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const bc = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastRef.current = bc;
    bc.onmessage = (e: MessageEvent<AuthBroadcast>) => {
      if (e.data?.type !== 'logout') return;
      if (accessTokenRef.current !== null || hadSession()) {
        setSessionEndedReason('signedOut');
      }
      clearLocalSession();
    };
    return () => {
      bc.close();
      broadcastRef.current = null;
    };
  }, [clearLocalSession]);

  // Silent refresh on mount: if a refresh-cookie exists, restore the session.
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void (async () => {
      await hydrate();
      setIsReady(true);
    })();
  }, [hydrate]);

  // After login/register the API returns a session-shaped user. We still call
  // /users/me to load the full profile (name, avatarUrl, timestamps).
  const completeSession = useCallback(
    async (accessToken: string): Promise<void> => {
      setAccessToken(accessToken);
      accessTokenRef.current = accessToken;
      markSession();
      setSessionEndedReason(null);
      try {
        const profile = await authApi.me();
        setUser(profile);
      } catch {
        // If /me fails right after a successful auth response, drop silently —
        // the next page will retry via hydrate().
        clearLocalSession();
      }
    },
    [clearLocalSession],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      try {
        const result = await authApi.login({ email, password });
        await completeSession(result.accessToken);
      } finally {
        setIsLoading(false);
      }
    },
    [completeSession],
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      setIsLoading(true);
      try {
        const result = await authApi.register({ email, password, name });
        await completeSession(result.accessToken);
      } finally {
        setIsLoading(false);
      }
    },
    [completeSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearLocalSession();
      setSessionEndedReason(null);
      broadcastRef.current?.postMessage({ type: 'logout' } satisfies AuthBroadcast);
    }
  }, [clearLocalSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isReady,
      sessionEndedReason,
      dismissSessionEnded,
      login,
      register,
      logout,
      hydrate,
    }),
    [
      user,
      accessToken,
      isLoading,
      isReady,
      sessionEndedReason,
      dismissSessionEnded,
      login,
      register,
      logout,
      hydrate,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <SessionExpiredOverlay reason={sessionEndedReason} onDismiss={dismissSessionEnded} />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
