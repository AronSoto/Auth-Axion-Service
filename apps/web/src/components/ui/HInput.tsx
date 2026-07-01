'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface HInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  endSlot?: ReactNode;
}

export const HInput = forwardRef<HTMLInputElement, HInputProps>(
  ({ label, error, hint, endSlot, className = '', id, ...props }, ref) => {
    const inputId = id ?? props.name;
    const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-medium tracking-tight text-foreground/70"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`h-11 w-full rounded-xl border bg-surface-2/60 px-3.5 text-sm text-foreground
              placeholder:text-muted/70 outline-none transition-[border-color,box-shadow,background-color]
              duration-150 focus:bg-surface-2 focus:ring-2 focus:ring-ring
              ${error ? 'border-danger/60 focus:border-danger' : 'border-border focus:border-primary/60'}
              ${endSlot ? 'pr-11' : ''} ${className}`}
            {...props}
          />
          {endSlot && <div className="absolute inset-y-0 right-2 flex items-center">{endSlot}</div>}
        </div>
        {error ? (
          <p id={`${inputId}-error`} className="text-xs text-danger">
            {error}
          </p>
        ) : hint ? (
          <p id={`${inputId}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
HInput.displayName = 'HInput';
