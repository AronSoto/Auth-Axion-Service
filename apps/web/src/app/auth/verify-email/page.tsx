'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { Button, Card } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/lib/use-page-entry';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  // Derive initial state from token presence so we don't setState inside the effect
  // for the "missing token" case (React 19 / react-hooks/set-state-in-effect).
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [errorMsg, setErrorMsg] = useState<string | null>(
    token ? null : 'Missing verification token in the URL.',
  );

  usePageEntry([status]);

  useEffect(() => {
    if (!token) return;
    void authApi.verifyEmail(token).then(
      () => setStatus('success'),
      (err: unknown) => {
        setStatus('error');
        setErrorMsg(err instanceof ApiError ? err.message : 'Verification failed.');
      },
    );
  }, [token]);

  return (
    <Card className="entry-card w-full max-w-md">
      <div className="mb-6 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.ico" alt="Axion" className="h-8 w-8" />
        <h1 className="text-base font-semibold">Email verification</h1>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Verifying your email…
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              ✓
            </span>
            <p className="text-sm">Your email is verified. You can now sign in.</p>
          </div>
          <Link href="/">
            <Button className="w-full">Go to sign in</Button>
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-5">
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {errorMsg ?? 'Verification failed.'}
          </p>
          <p className="text-xs text-muted">
            The link may have expired or already been used. Sign in and request a new verification
            email from the resend endpoint, or try registering again.
          </p>
          <Link href="/">
            <Button variant="secondary" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 left-1/2 h-100 w-160 -translate-x-1/2 glow pointer-events-none" />
      <div className="relative z-10">
        <Suspense
          fallback={
            <Card className="w-full max-w-md">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </Card>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
