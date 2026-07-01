import type { ElementType, ReactNode } from 'react';

type HTextVariant = 'h1' | 'h2' | 'title' | 'body' | 'muted' | 'label';

const variantClasses: Record<HTextVariant, string> = {
  h1: 'text-2xl font-semibold tracking-tight text-foreground',
  h2: 'text-base font-semibold tracking-tight text-foreground',
  title: 'text-sm font-semibold tracking-tight text-foreground',
  body: 'text-sm text-foreground',
  muted: 'text-sm text-muted',
  label: 'text-xs font-medium tracking-tight text-muted',
};

const defaultTag: Record<HTextVariant, ElementType> = {
  h1: 'h1',
  h2: 'h2',
  title: 'h3',
  body: 'p',
  muted: 'p',
  label: 'span',
};

// Typography primitive — consistent headings/body without ad-hoc class soup.
export function HText({
  as,
  variant = 'body',
  className = '',
  children,
}: {
  as?: ElementType;
  variant?: HTextVariant;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as ?? defaultTag[variant];
  return <Tag className={`${variantClasses[variant]} ${className}`}>{children}</Tag>;
}
