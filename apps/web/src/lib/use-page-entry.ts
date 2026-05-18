'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { DependencyList } from 'react';

// Motion language stays consistent.
function ambientGlow(direction: { x: number; y: number; duration?: number }) {
  gsap.to('.glow', {
    x: direction.x,
    y: direction.y,
    repeat: -1,
    yoyo: true,
    duration: direction.duration ?? 6,
    ease: 'sine.inOut',
  });
}

export function usePageEntry(deps: DependencyList = []): void {
  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.entry-card',
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 },
        0,
      ).fromTo(
        '.entry-stagger > *',
        { y: 14, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.06, duration: 0.5 },
        '-=0.3',
      );

      ambientGlow({ x: 18, y: -8 });
    },
    { dependencies: [...deps] },
  );
}

// Standalone drift for pages that own their entry timeline (landing, dashboard).
export function useAmbientGlow(
  direction: { x: number; y: number; duration?: number },
  deps: DependencyList = [],
): void {
  useGSAP(
    () => {
      ambientGlow(direction);
    },
    { dependencies: [...deps] },
  );
}
