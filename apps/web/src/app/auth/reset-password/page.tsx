'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { Button, Card, Input } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/lib/use-page-entry';

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
      <Card className="entry-card w-full max-w-md">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              ✓
            </span>
            <p className="text-sm">Password updated. Redirecting to sign in…</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="entry-card w-full max-w-md">
      <div className="mb-6 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon.ico" alt="Axion" className="h-8 w-8" />
        <h1 className="text-base font-semibold">Set a new password</h1>
      </div>

      <form onSubmit={handleSubmit} className="entry-stagger flex flex-col gap-4">
        <Input
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
        <Input
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

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
            {error}
          </p>
        )}

        <Button type="submit" isLoading={isLoading} className="mt-1">
          Update password
        </Button>

        <p className="text-center text-xs text-muted">
          <Link href="/" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
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
          <ResetPasswordContent />
        </Suspense>
      </div>
    </main>
  );
}
