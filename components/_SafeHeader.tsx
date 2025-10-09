'use client';
import Link from 'next/link';

export default function SafeHeader() {
  return (
    <nav className="flex items-center justify-between gap-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="underline-offset-4 hover:underline">Home</Link>
        <Link href="/global" className="hx-btn hx-btn--secondary px-3 py-2 text-sm">Global Exchange</Link>
        <Link href="/offers" className="hx-btn hx-btn--secondary px-3 py-2 text-sm">Browse Offers</Link>
        <Link href="/exchanges" className="hx-btn hx-btn--secondary px-3 py-2 text-sm">My Exchanges</Link>
        <Link href="/chapters" className="hx-btn hx-btn--secondary px-3 py-2 text-sm">Local Chapters</Link>
        <Link href="/inbox" className="underline-offset-4 hover:underline">Inbox</Link>
      </div>
    </nav>
  );
}
