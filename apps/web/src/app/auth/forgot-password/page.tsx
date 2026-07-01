'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { CheckIcon, HButton, HCallout, HCard, HInput, HText, Logo } from '@/components/ui';
import { ApiError, authApi } from '@/lib/api';
import { usePageEntry } from '@/hooks/use-page-entry';

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
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <HCard className="entry-card relative z-10 w-full max-w-md">
        <div className="mb-6 flex items-center gap-2.5">
          <Logo />
          <HText as="h1" variant="h2">
            Reset your password
          </HText>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="entry-stagger flex flex-col gap-4">
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a link to reset your password.
            </p>
            <HInput
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {error && <HCallout tone="danger">{error}</HCallout>}
            <HButton type="submit" isLoading={isLoading} className="mt-1">
              Send reset link
            </HButton>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <HCallout tone="success">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>If that email exists, a reset link is on its way.</span>
            </HCallout>
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
      </HCard>
    </main>
  );
}
