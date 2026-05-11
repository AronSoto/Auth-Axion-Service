'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { Button, Card, Input } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/lib/use-page-entry';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageEntry();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-16">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute top-0 left-1/2 h-100 w-160 -translate-x-1/2 glow pointer-events-none" />

      <Card className="entry-card relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.ico" alt="Axion" className="h-8 w-8" />
          <h1 className="text-base font-semibold">Reset your password</h1>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="entry-stagger flex flex-col gap-4">
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                {error}
              </p>
            )}
            <Button type="submit" isLoading={isLoading} className="mt-1">
              Send reset link
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                ✓
              </span>
              <p className="text-sm">If that email exists, a reset link is on its way.</p>
            </div>
            <p className="text-xs text-muted">
              We never reveal whether an email is registered. Check your inbox in a minute or two.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          <Link href="/" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}
