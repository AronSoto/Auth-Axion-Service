import type { ReactNode } from 'react';

export function HBadge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: 'neutral' | 'success' | 'amber';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'border-border bg-surface-2 text-muted',
    success: 'border-success/30 bg-success/10 text-success',
    amber: 'border-primary/30 bg-primary/10 text-primary',
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
