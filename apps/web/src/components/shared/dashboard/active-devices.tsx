'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { HButton, HCard } from '@/components/ui';
import { ApiError, SessionInfo, authApi } from '@/lib/api';

function deviceLabel(s: SessionInfo): string {
  if (s.browser && s.os) return `${s.browser} · ${s.os}`;
  return s.browser ?? s.os ?? 'Unknown device';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ::1 / 127.0.0.1 are loopback (you, on this machine) — show something human.
function formatIp(ip: string | null): string {
  if (!ip || ip === '::1' || ip === '127.0.0.1') return 'Local';
  return ip;
}

function DeviceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export function ActiveDevices() {
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await authApi.sessions();
        if (active) setSessions(data);
      } catch (err) {
        if (active) {
          setError(err instanceof ApiError ? err.message : 'Failed to load devices');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleRevoke(id: string) {
    setRevoking(id);
    try {
      await authApi.revokeSession(id);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  }

  return (
    <HCard className="dash-card mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Active devices</h2>
        <span className="text-xs text-muted">{sessions ? `${sessions.length} active` : ''}</span>
      </div>
      <p className="mt-1 text-xs text-muted">Sessions currently signed in to your account.</p>

      {error && <p className="mt-4 text-xs text-danger">{error}</p>}

      {!sessions && !error && (
        <div className="mt-4 flex justify-center py-4">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-muted" />
        </div>
      )}

      {sessions && (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          <AnimatePresence initial={false}>
            {sessions.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={false}
                exit={{ opacity: 0, x: -12 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="flex items-center gap-3 py-3"
              >
                <DeviceIcon />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{deviceLabel(s)}</span>
                    {s.current && (
                      <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        This device
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {formatIp(s.ipAddress)} · Started {formatDate(s.createdAt)}
                  </p>
                </div>
                {!s.current && (
                  <HButton
                    variant="secondary"
                    size="sm"
                    isLoading={revoking === s.id}
                    onClick={() => handleRevoke(s.id)}
                  >
                    Sign out
                  </HButton>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </HCard>
  );
}
