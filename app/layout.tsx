// app/layout.tsx

import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import ClientHeaderNav from '@/components/ClientHeaderNav';

/**
 * Link preview (OG/Twitter) image:
 * Place the file in /public/harmonic-cover2.jpg
 * and it will resolve at https://<your-domain>/harmonic-cover2.jpg
 *
 * If you have NEXT_PUBLIC_SITE_URL set, we'll use it; otherwise we default to your domain.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://harmonicexchanges.com';
const OG_IMAGE = `${SITE_URL}/harmonic-cover2.jpg`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Harmonic Exchange – Gift-based Collaboration Network',
  description:
    'Join Harmonic Exchange to trade skills, services, and creativity in a trust-based marketplace that values people over profit.',
  openGraph: {
    title: 'Harmonic Exchange – Gift-based Collaboration Network',
    description:
      'A global network for exchanging value through generosity and collaboration.',
    url: SITE_URL,
    siteName: 'Harmonic Exchange',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'Harmonic Exchange – Gift-based Collaboration Network',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Harmonic Exchange – Gift-based Collaboration Network',
    description:
      'Trade skills and services through generosity. Discover the new way to exchange value.',
    images: [OG_IMAGE],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto max-w-5xl px-3">
            <ClientHeaderNav />
          </div>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  );
}
