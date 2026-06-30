// Wraps the favicon as a logo to keep the eslint-disable in one place.
/* eslint-disable @next/next/no-img-element */

interface LogoProps {
  className?: string;
  alt?: string;
}

export function Logo({ className = 'h-8 w-8', alt = 'Auth Axion' }: LogoProps) {
  return <img src="/favicon.ico" alt={alt} className={className} />;
}
