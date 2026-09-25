import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'TelemetrySpend',
  description:
    'Estimate observability costs across Datadog, Grafana Cloud, AWS CloudWatch, and Honeycomb before you ship the config change.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-line">
          <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="font-mono text-sm font-medium tracking-tight">
              telemetryspend
            </Link>
            <Link href="/calculator" className="text-sm text-muted transition-colors hover:text-fg">
              Calculator
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
