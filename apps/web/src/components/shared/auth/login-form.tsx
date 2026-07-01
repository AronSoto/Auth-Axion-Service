'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { GithubIcon, GoogleIcon, HButton, HCallout, HInput } from '@/components/ui';
import { Magnetic } from '@/components/shared/motion/magnetic';
import { ApiError, oauthUrls } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const oauthButtonClass =
  'group flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-2/60 px-3 py-2.5 text-sm font-medium transition-colors hover:border-border-strong hover:bg-surface-2';

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please retry.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Magnetic strength={0.25}>
          <a href={oauthUrls.google} className={oauthButtonClass}>
            <GoogleIcon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:rotate-6" />
            Google
          </a>
        </Magnetic>
        <Magnetic strength={0.25}>
          <a href={oauthUrls.github} className={oauthButtonClass}>
            <GithubIcon className="h-4 w-4 transition-transform duration-300 ease-out group-hover:scale-110 group-hover:-rotate-6" />
            GitHub
          </a>
        </Magnetic>
      </div>

      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-card px-2 text-muted">or with email</span>
        </div>
      </div>

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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-medium text-foreground/70">
            Password
          </label>
          <Link
            href="/auth/forgot-password"
            className="text-[11px] text-muted hover:text-foreground hover:underline"
          >
            Forgot?
          </Link>
        </div>
        <HInput
          name="password"
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <HCallout tone="danger">{error}</HCallout>}

      <HButton type="submit" isLoading={isLoading} className="mt-2">
        Sign in
      </HButton>

      <p className="text-center text-xs text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/auth/register" className="text-primary hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}
