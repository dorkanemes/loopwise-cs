import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { TODAY } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Loopwise CS',
  description: 'Customer success workspace for the Loopwise portfolio',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const d = new Date(TODAY + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="brand">Loopwise <span>CS</span></Link>
            <nav className="nav">
              <Link href="/">Portfolio</Link>
              <Link href="/call-list">Monday call list</Link>
              <Link href="/renewals">Renewals &amp; risk</Link>
              <Link href="/tasks">Tasks</Link>
              <Link href="/scoring">How scoring works</Link>
              <Link href="/data-issues">Data issues</Link>
            </nav>
            <div className="today" title="Scenario date from the brief; all recency and renewal maths uses it">Today: {d}</div>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
