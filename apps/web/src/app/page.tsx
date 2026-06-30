'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef } from 'react';

import { Logo } from '@/components/logo';
import { LoginForm } from '@/components/login-form';
import { Card } from '@/components/ui';
import { swaggerUrl } from '@/lib/api';

// Maps the `?error=...` codes from OAuthCallbackFilter to human-readable text.
const ERROR_MESSAGES: Record<string, string> = {
  oauth_failed: 'Sign-in failed. Please try again.',
  oauth_unverified:
    "We couldn't link your provider account because the email isn't verified at the provider.",
  oauth_disabled: 'Your account is disabled. Contact support.',
};

function LandingPageContent() {
  const root = useRef<HTMLElement>(null);
  const params = useSearchParams();
  const errorCode = params.get('error');
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? 'Something went wrong. Please try again.')
    : null;

  useGSAP(
    () => {
      const tl = gsap.timeline({
        defaults: { ease: 'power3.out', duration: 0.7 },
      });

      tl.from('.bg-grid', { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0)
        .from('.glow', { opacity: 0, scale: 0.6, duration: 1.4, ease: 'power2.out' }, 0)
        .from('.hero-badge', { y: 12, opacity: 0, duration: 0.5 }, 0.1)
        .from('.hero-title-line', { y: 36, opacity: 0, stagger: 0.08, duration: 0.8 }, 0.2)
        .from('.hero-sub', { y: 16, opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.feature-item', { y: 18, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.35')
        .from('.hero-link', { y: 10, opacity: 0, stagger: 0.08, duration: 0.45 }, '-=0.2')
        .from('.login-card', { x: 32, opacity: 0, duration: 0.9, ease: 'back.out(1.4)' }, 0.35)
        .from('.login-caption', { y: 8, opacity: 0, duration: 0.5 }, '-=0.4');

      gsap.to('.live-dot', {
        scale: 1.4,
        opacity: 0.6,
        repeat: -1,
        yoyo: true,
        duration: 1.1,
        ease: 'sine.inOut',
      });

      gsap.to('.glow', {
        x: 24,
        y: -12,
        repeat: -1,
        yoyo: true,
        duration: 6,
        ease: 'sine.inOut',
      });
    },
    { scope: root },
  );

  return (
    <main ref={root} className="relative flex-1 overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute -top-40 left-1/2 h-120 w-205 -translate-x-1/2 glow pointer-events-none" />

      <div className="relative mx-auto grid min-h-[calc(100vh-1px)] max-w-6xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-[1.1fr_minmax(380px,420px)] lg:items-center lg:px-10">
        {/* Left: pitch */}
        <section>
          <div className="hero-badge mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Auth backend live · NestJS · v1.2
          </div>

          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
            <span className="hero-title-line block">Authentication,</span>
            <span className="hero-title-line block bg-linear-to-br from-primary to-blue-500 bg-clip-text text-transparent">
              cleanly architected.
            </span>
          </h1>

          <p className="hero-sub mt-6 max-w-lg text-base leading-relaxed text-muted">
            Auth Axion is a standalone authentication service: JWT with refresh-token rotation,
            Google &amp; GitHub OAuth, email verification, password reset. Built with NestJS,
            Prisma, and PostgreSQL.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {[
              'JWT + refresh rotation',
              'Reuse-detection on revoked tokens',
              'OAuth — Google, GitHub',
              'Email verify · password reset',
              'Role-based guards (RBAC)',
              'Swagger / OpenAPI docs',
            ].map((feat) => (
              <li key={feat} className="feature-item flex items-center gap-2 text-foreground/85">
                <span className="text-primary">▸</span>
                {feat}
              </li>
            ))}
          </ul>

          <div className="mt-10 flex items-center gap-3 text-xs text-muted">
            <a
              href={swaggerUrl}
              target="_blank"
              rel="noreferrer"
              className="hero-link underline hover:text-foreground"
            >
              API docs (Swagger) →
            </a>
            <span>·</span>
            <a
              href="https://github.com/AronSoto/Auth-Axion-Service"
              target="_blank"
              rel="noreferrer"
              className="hero-link underline hover:text-foreground"
            >
              Source on GitHub →
            </a>
          </div>
        </section>

        {/* Right: login card */}
        <section className="login-card">
          <Card>
            <div className="mb-6 flex items-center gap-2.5">
              <Logo />
              <h2 className="text-base font-semibold">Sign in to demo</h2>
            </div>
            {errorMessage && (
              <p
                role="alert"
                className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-500"
              >
                {errorMessage}
              </p>
            )}
            <LoginForm />
          </Card>
          <p className="login-caption mt-4 text-center text-[11px] text-muted">
            New here?{' '}
            <Link href="/auth/register" className="text-foreground/80 hover:underline">
              Create a test account
            </Link>{' '}
            — verification email goes to the configured Mailtrap inbox.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function LandingPage() {
  // useSearchParams must be wrapped in Suspense in app router.
  return (
    <Suspense fallback={<main className="flex-1" aria-hidden="true" />}>
      <LandingPageContent />
    </Suspense>
  );
}
