'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useRef, type ReactNode } from 'react';

// Pulls its child slightly toward the cursor, then springs back on leave.
// Uses motion values (no React state) so it never re-renders on move.
export function Magnetic({
  children,
  strength = 0.35,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 160, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 160, damping: 15, mass: 0.1 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
