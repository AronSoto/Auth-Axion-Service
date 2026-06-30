'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ActiveDevices } from '@/components/active-devices';
import { Logo } from '@/components/logo';
import { Button, Card } from '@/components/ui';
import { swaggerUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isReady, sessionEndedReason, logout } = useAuth();

  useEffect(() => {
    if (isReady && !user && !sessionEndedReason) router.replace('/');
  }, [isReady, user, sessionEndedReason, router]);

  // Custom dashboard timeline — header → main card → resource grid.
  // Re-runs once the auth guard resolves (user/isReady become truthy).
  useGSAP(
    () => {
      if (!isReady || !user) return;

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.dash-header', { y: -16, opacity: 0, duration: 0.6 }, 0)
        .from('.dash-card', { y: 24, opacity: 0, duration: 0.7 }, 0.1)
        .from('.dash-info > *', { y: 12, opacity: 0, stagger: 0.08, duration: 0.5 }, '-=0.35')
        .from('.dash-resource', { y: 18, opacity: 0, stagger: 0.1, duration: 0.55 }, '-=0.25');

      gsap.to('.glow', {
        x: -18,
        y: 10,
        repeat: -1,
        yoyo: true,
        duration: 6.5,
        ease: 'sine.inOut',
      });
    },
    { dependencies: [isReady, user] },
  );

  if (!isReady) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      </main>
    );
  }
  // Keep the flex slot filled so the footer stays at the bottom under the overlay.
  if (!user) return <main className="flex-1" aria-hidden="true" />;

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <main className="relative flex-1 overflow-hidden px-6 py-12">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute -top-40 right-0 h-100 w-160 glow pointer-events-none" />

      <div className="relative mx-auto max-w-3xl">
        <div className="dash-header mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-semibold">Auth Axion</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        <Card className="dash-card">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome, {user.name ?? user.email.split('@')[0]} 👋
          </h1>
          <p className="mt-2 text-sm text-muted">
            You&apos;re signed in. The dashboard is intentionally minimal — the goal of this project
            is the auth backend.
          </p>

          <dl className="dash-info mt-8 grid grid-cols-1 gap-x-8 gap-y-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">User ID</dt>
              <dd className="mt-1 font-mono text-[13px] break-all">{user.id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Email</dt>
              <dd className="mt-1 break-all">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">Role</dt>
              <dd className="mt-1">
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium">
                  {user.role}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <ActiveDevices />

        <div className="mt-6 grid gap-4 text-xs text-muted sm:grid-cols-2">
          <a
            href={swaggerUrl}
            target="_blank"
            rel="noreferrer"
            className="dash-resource rounded-xl border border-border bg-card p-4 transition-colors hover:bg-border/20"
          >
            <p className="text-sm font-medium text-foreground">Open API docs</p>
            <p className="mt-1">All endpoints documented via Swagger / OpenAPI.</p>
          </a>
          <a
            href="https://github.com/AronSoto/Auth-Axion-Service"
            target="_blank"
            rel="noreferrer"
            className="dash-resource rounded-xl border border-border bg-card p-4 transition-colors hover:bg-border/20"
          >
            <p className="text-sm font-medium text-foreground">View source</p>
            <p className="mt-1">Architecture, modules, Prisma schema — all on GitHub.</p>
          </a>
        </div>
      </div>
    </main>
  );
}
