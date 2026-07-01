'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { DependencyList } from 'react';

// Shared entrance timeline for card-based pages. The animated backdrop lives
// globally in the constellation background, so pages no longer own their glow.
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
    },
    { dependencies: [...deps] },
  );
}
