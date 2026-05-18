'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

import { useAuth } from '@/lib/auth-context';

function OAuthCallbackContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.oauth-shell', {
        scale: 0.85,
        opacity: 0,
        duration: 0.5,
        ease: 'power3.out',
      });
      gsap.from('.oauth-text', {
        y: 8,
        opacity: 0,
        duration: 0.5,
        delay: 0.15,
        ease: 'power2.out',
      });
    },
    { scope: root },
  );

  const errorParam = params.get('error');

  useEffect(() => {
    if (errorParam) {
      router.replace(`/?error=${encodeURIComponent(errorParam)}`);
      return;
    }
    void (async () => {
      const token = await refresh();
      router.replace(token ? '/dashboard' : '/?error=oauth_failed');
    })();
  }, [refresh, router, errorParam]);

  return (
    <main ref={root} className="flex flex-1 items-center justify-center">
      <div className="oauth-shell flex flex-col items-center gap-3 text-muted">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <p className="oauth-text text-sm">Finishing sign-in…</p>
      </div>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </main>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
