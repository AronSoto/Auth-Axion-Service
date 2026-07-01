'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

interface HButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary-hover shadow-[0_1px_0_rgba(255,255,255,0.15)_inset]',
  secondary:
    'bg-surface-2 text-foreground border border-border hover:border-border-strong hover:bg-surface-2/70',
  ghost: 'text-muted hover:text-foreground hover:bg-surface-2',
  danger: 'bg-danger text-danger-foreground hover:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-sm',
};

export const HButton = forwardRef<HTMLButtonElement, HButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading,
      className = '',
      children,
      disabled,
      onMouseMove,
      ...props
    },
    ref,
  ) => {
    // Track the cursor as CSS vars for the spotlight — no React re-render.
    const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--spot-x', `${e.clientX - r.left}px`);
      e.currentTarget.style.setProperty('--spot-y', `${e.clientY - r.top}px`);
      onMouseMove?.(e);
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        onMouseMove={handleMove}
        className={`group relative inline-flex items-center justify-center overflow-hidden rounded-xl font-medium tracking-tight
          outline-none transition-[transform,background-color,border-color,opacity,color] duration-150
          ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:ring-2 focus-visible:ring-ring
          active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {variant === 'primary' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(90px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(255,255,255,0.28), transparent 65%)',
            }}
          />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">
          {isLoading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {children}
        </span>
      </button>
    );
  },
);
HButton.displayName = 'HButton';
