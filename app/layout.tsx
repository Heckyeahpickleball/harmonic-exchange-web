// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import ClientHeaderNav from '@/components/ClientHeaderNav';

export const metadata: Metadata = {
  title: 'Harmonic Exchange',
  description: 'Exploring a new way of living through cooperation and mutual support',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#fafafa] text-slate-900 antialiased">
        <div className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-4">
            <ClientHeaderNav />
          </div>
        </div>

        <main className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
