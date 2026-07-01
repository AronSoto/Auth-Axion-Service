import type { ReactNode } from 'react';

export function HCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-lg)] ${className}`}
    >
      {children}
    </div>
  );
}
