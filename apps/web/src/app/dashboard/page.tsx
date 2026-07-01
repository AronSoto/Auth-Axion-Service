'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ActiveDevices } from '@/components/shared/dashboard/active-devices';
import { CheckIcon, HBadge, HButton, HCard, Logo } from '@/components/ui';
import { swaggerUrl, type UserProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function Avatar({ user }: { user: UserProfile }) {
  const initial = (user.name ?? user.email).trim().charAt(0).toUpperCase();
  if (user.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        className="h-14 w-14 rounded-2xl border border-border object-cover"
      />
    );
  }
  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/12 text-xl font-semibold text-primary">
      {initial}
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <dt className="shrink-0 text-xs font-medium tracking-tight text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm">{children}</dd>
    </div>
  );
}

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy user ID"
      className="group inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1
        font-mono text-[12px] text-foreground/80 transition-colors hover:border-border-strong hover:text-foreground
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <CheckIcon className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          className="h-3.5 w-3.5 shrink-0 text-muted group-hover:text-foreground"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}

const RESOURCES = [
  {
    href: swaggerUrl,
    title: 'API documentation',
    body: 'Every endpoint, documented via Swagger / OpenAPI.',
  },
  {
    href: 'https://github.com/AronSoto/Auth-Axion-Service',
    title: 'Source code',
    body: 'Architecture, modules, and the Prisma schema on GitHub.',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isReady, sessionEndedReason, logout } = useAuth();

  useEffect(() => {
    if (isReady && !user && !sessionEndedReason) router.replace('/');
  }, [isReady, user, sessionEndedReason, router]);

  useGSAP(
    () => {
      if (!isReady || !user) return;
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.dash-header', { y: -16, opacity: 0, duration: 0.6 }, 0)
        .from('.dash-card', { y: 24, opacity: 0, duration: 0.7 }, 0.1)
        .from('.dash-info > *', { y: 12, opacity: 0, stagger: 0.07, duration: 0.5 }, '-=0.35')
        .from('.dash-resource', { y: 18, opacity: 0, stagger: 0.1, duration: 0.55 }, '-=0.25');
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
  if (!user) return <main className="flex-1" aria-hidden="true" />;

  const displayName = user.name ?? user.email.split('@')[0];
  const verified = Boolean(user.emailVerifiedAt);

  async function handleLogout() {
    await logout();
    router.replace('/');
  }

  return (
    <main className="relative flex-1 px-6 py-10">
      <div className="relative mx-auto max-w-3xl">
        <header className="dash-header mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-tight">Auth Axion</span>
          </div>
          <HButton variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </HButton>
        </header>

        <HCard className="dash-card">
          <div className="flex items-start gap-4">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight">Welcome back, {displayName}</h1>
              <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <HBadge tone="amber">{user.role}</HBadge>
                {verified ? (
                  <HBadge tone="success">
                    <CheckIcon className="h-3 w-3" />
                    Email verified
                  </HBadge>
                ) : (
                  <HBadge tone="neutral">Email not verified</HBadge>
                )}
              </div>
            </div>
          </div>

          <dl className="dash-info mt-7 divide-y divide-border border-t border-border">
            <DetailRow label="User ID">
              <CopyableId value={user.id} />
            </DetailRow>
            <DetailRow label="Member since">
              <span className="text-foreground/80">{formatDate(user.createdAt)}</span>
            </DetailRow>
          </dl>
        </HCard>

        <ActiveDevices />

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {RESOURCES.map((r) => (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noreferrer"
              className="dash-resource group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong hover:bg-surface-2/50"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden="true"
                >
                  <path d="M7 17 17 7M8 7h9v9" />
                </svg>
              </div>
              <p className="mt-1.5 text-xs text-muted">{r.body}</p>
            </a>
          ))}
        </div>
      </div>
    </main>
  );
}
