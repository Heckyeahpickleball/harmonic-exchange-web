// app/layout.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import NotificationsBell from '@/components/NotificationsBell';

export const metadata: Metadata = {
  title: 'Harmonic Exchange',
  description: 'Gift-based collaboration marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="px-4 py-3 border-b">
          <nav className="flex items-center justify-between text-sm">
            <div className="flex gap-4">
              <Link href="/">Home</Link>
              <Link href="/offers">Browse</Link>
              <Link href="/offers/new">New Offer</Link>
              <Link href="/offers/mine">My Offers</Link>
              <Link href="/sign-in">Sign In</Link>
              <Link href="/profile">Profile</Link>
              <Link href="/admin">Admin</Link>
            </div>
            <NotificationsBell />
          </nav>
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
