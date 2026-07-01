'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { CheckIcon, HButton, HCallout, HCard, HInput, HText, Logo } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/hooks/use-page-entry';

function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageEntry([done]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing reset token in the URL.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      // Brief pause so the success message is visible before redirect.
      setTimeout(() => router.replace('/'), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reset failed.');
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <HCard className="entry-card w-full max-w-md">
        <HCallout tone="success">
          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Password updated. Redirecting to sign in…</span>
        </HCallout>
      </HCard>
    );
  }

  return (
    <HCard className="entry-card w-full max-w-md">
      <div className="mb-6 flex items-center gap-2.5">
        <Logo />
        <HText as="h1" variant="h2">
          Set a new password
        </HText>
      </div>

      <form onSubmit={handleSubmit} className="entry-stagger flex flex-col gap-4">
        <HInput
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <HInput
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Repeat your new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && <HCallout tone="danger">{error}</HCallout>}

        <HButton type="submit" isLoading={isLoading} className="mt-1">
          Update password
        </HButton>

        <p className="text-center text-xs text-muted">
          <Link href="/" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </HCard>
  );
}

export default function ResetPasswordPage() {
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
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
