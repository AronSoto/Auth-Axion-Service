import type { ReactNode } from 'react';

// Inline status message (form errors / notices).
export function HCallout({
  tone = 'danger',
  children,
  className = '',
}: {
  tone?: 'danger' | 'success' | 'muted';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: 'border-danger/25 bg-danger/10 text-danger',
    success: 'border-success/25 bg-success/10 text-success',
    muted: 'border-border bg-surface-2 text-muted',
  } as const;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${tones[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
