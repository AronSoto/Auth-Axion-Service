'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  open: boolean;
  onDismiss: () => void;
  autoRedirectMs?: number;
  redirectTo?: string;
}

export function SessionExpiredOverlay(props: Props) {
  // Remount fresh on each open so state initialisers stay declarative.
  if (!props.open) return null;
  return <OverlayBody {...props} />;
}

function OverlayBody({ onDismiss, autoRedirectMs = 6000, redirectTo = '/' }: Props) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [endTime] = useState(() => Date.now() + autoRedirectMs);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    buttonRef.current?.focus();

    const interval = window.setInterval(() => setNow(Date.now()), 250);
    const redirect = window.setTimeout(() => {
      onDismiss();
      router.replace(redirectTo);
    }, autoRedirectMs);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onDismiss();
        router.replace(redirectTo);
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(redirect);
      window.removeEventListener('keydown', onKey);
    };
  }, [autoRedirectMs, redirectTo, onDismiss, router]);

  const secondsLeft = Math.max(0, Math.ceil((endTime - now) / 1000));

  const close = () => {
    onDismiss();
    router.replace(redirectTo);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-desc"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-overlay-in"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" onClick={close} />

      <div
        className="relative w-full max-w-md rounded-4xl border border-border bg-card p-10
                   shadow-[0_20px_60px_-20px_rgba(0,0,0,0.18)]
                   animate-panel-in"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-4xl
                     shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        />

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-background/60">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-foreground"
            aria-hidden="true"
          >
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            <circle cx="12" cy="15" r="1.25" fill="currentColor" stroke="none" />
          </svg>
        </div>

        <h2 id="session-expired-title" className="mt-6 text-2xl font-semibold tracking-tight">
          Your session expired
        </h2>

        <p
          id="session-expired-desc"
          className="mt-2 max-w-[42ch] text-sm leading-relaxed text-muted"
        >
          For your security, you were signed out after a period of inactivity. Sign back in to pick
          up where you left off.
        </p>

        <div
          className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-5"
          aria-live="polite"
        >
          <span className="text-xs text-muted">
            Redirecting in{' '}
            <span className="font-mono tabular-nums text-foreground">{secondsLeft}s</span>
          </span>

          <button
            ref={buttonRef}
            type="button"
            onClick={close}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5
                       text-sm font-medium text-background
                       transition-[transform,box-shadow] duration-150
                       hover:shadow-[0_8px_20px_-8px_rgba(0,0,0,0.35)]
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                       active:translate-y-px"
          >
            Back to home
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
