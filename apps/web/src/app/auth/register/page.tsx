'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { HButton, HCallout, HCard, HInput, HText, Logo } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { usePageEntry } from '@/hooks/use-page-entry';

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  usePageEntry();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await register(email, password, name || undefined);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please retry.');
    }
  }

  return (
    <main className="relative flex flex-1 items-center justify-center px-6 py-16">
      <HCard className="entry-card relative z-10 w-full max-w-md">
        <div className="mb-7 flex items-center gap-2.5">
          <Logo />
          <HText as="h1" variant="h2">
            Create your account
          </HText>
        </div>

        <form onSubmit={handleSubmit} className="entry-stagger flex flex-col gap-4">
          <HInput
            label="Name (optional)"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Aron Soto"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
          <HInput
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <HCallout tone="danger">{error}</HCallout>}

          <HButton type="submit" isLoading={isLoading} className="mt-1">
            Create account
          </HButton>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Already registered?{' '}
          <Link href="/" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </HCard>
    </main>
  );
}
