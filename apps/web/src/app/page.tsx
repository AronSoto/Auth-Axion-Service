'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef } from 'react';
import { LoginForm } from '@/components/shared/auth/login-form';
import { HCallout, HCard, HText, Logo } from '@/components/ui';
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

      tl.from('.hero-badge', { y: 12, opacity: 0, duration: 0.5 }, 0.1)
        .from('.hero-title-line', { y: 36, opacity: 0, stagger: 0.08, duration: 0.8 }, 0.2)
        .from('.hero-sub', { y: 16, opacity: 0, duration: 0.6 }, '-=0.5')
        .from('.feature-item', { y: 18, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.35')
        .from('.hero-link', { y: 10, opacity: 0, stagger: 0.08, duration: 0.45 }, '-=0.2')
        .from('.login-card', { x: 32, opacity: 0, duration: 0.9, ease: 'back.out(1.4)' }, 0.35);

      gsap.to('.live-dot', {
        scale: 1.4,
        opacity: 0.6,
        repeat: -1,
        yoyo: true,
        duration: 1.1,
        ease: 'sine.inOut',
      });
    },
    { scope: root },
  );

  return (
    <main ref={root} className="relative flex-1">
      <div className="relative mx-auto grid min-h-[calc(100dvh-1px)] max-w-6xl grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-[1.1fr_minmax(380px,420px)] lg:items-center lg:px-10">
        {/* Left: pitch */}
        <section>
          <div className="hero-badge mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-success" />
            Auth Live · v3.0
          </div>

          <h1 className="text-4xl font-semibold tracking-tighter sm:text-5xl lg:text-[3.5rem] lg:leading-[1.03]">
            <span className="hero-title-line block text-foreground">Authentication,</span>
            <span className="hero-title-line block text-primary">cleanly architected.</span>
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
          <HCard>
            <div className="mb-6 flex items-center gap-2.5">
              <Logo />
              <HText as="h2" variant="h2">
                Sign in to demo
              </HText>
            </div>
            {errorMessage && (
              <HCallout tone="danger" className="mb-4">
                {errorMessage}
              </HCallout>
            )}
            <LoginForm />
          </HCard>
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
