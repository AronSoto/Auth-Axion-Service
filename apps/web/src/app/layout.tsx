import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Auth Axion — modern authentication, ready to consume',
  description:
    'Standalone NestJS authentication service: JWT, refresh rotation, OAuth (Google, GitHub), email verification, password reset.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
        <footer className="relative z-10 border-t border-border bg-background/60 px-6 py-5 text-[11px] text-muted backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
            <span>© 2026 Auth Axion · Portfolio project</span>
            <span className="flex items-center gap-1.5">
              Crafted by
              <a
                href="https://github.com/AronSoto"
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground hover:underline"
                aria-label="GitHub profile"
              >
                @AronSoto
              </a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
