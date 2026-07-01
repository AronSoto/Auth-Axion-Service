'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { CheckIcon, HButton, HCallout, HCard, HText, Logo } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/hooks/use-page-entry';

type Status = 'loading' | 'success' | 'error';

function VerifyEmailContent() {
  const params = useSearchParams();
  const token = params.get('token');
  // Derive initial state from token presence so we don't setState inside the
  // effect for the "missing token" case (react-hooks/set-state-in-effect).
  const [status, setStatus] = useState<Status>(token ? 'loading' : 'error');
  const [errorMsg, setErrorMsg] = useState<string | null>(
    token ? null : 'Missing verification token in the URL.',
  );

  usePageEntry([status]);

  // Single-use token, guard against Strict Mode double-run.
  const submitted = useRef(false);

  useEffect(() => {
    if (!token || submitted.current) return;
    submitted.current = true;
    void authApi.verifyEmail(token).then(
      () => setStatus('success'),
      (err: unknown) => {
        setStatus('error');
        setErrorMsg(err instanceof ApiError ? err.message : 'Verification failed.');
      },
    );
  }, [token]);

  return (
    <HCard className="entry-card w-full max-w-md">
      <div className="mb-6 flex items-center gap-2.5">
        <Logo />
        <HText as="h1" variant="h2">
          Email verification
        </HText>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Verifying your email…
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col gap-5">
          <HCallout tone="success">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Your email is verified. You can now sign in.</span>
          </HCallout>
          <Link href="/">
            <HButton className="w-full">Go to sign in</HButton>
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-5">
          <HCallout tone="danger">{errorMsg ?? 'Verification failed.'}</HCallout>
          <p className="text-xs text-muted">
            The link may have expired or already been used. Sign in and request a new verification
            email, or try registering again.
          </p>
          <Link href="/">
            <HButton variant="secondary" className="w-full">
              Back to sign in
            </HButton>
          </Link>
        </div>
      )}
    </HCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="relative z-10">
        <Suspense
          fallback={
            <HCard className="w-full max-w-md">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </HCard>
          }
        >
          <VerifyEmailContent />
        </Suspense>
      </div>
    </main>
  );
}
