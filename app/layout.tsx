import './globals.css'
import Link from 'next/link'
import NotificationsBell from '@/components/NotificationsBell'

export const metadata = { title: 'Harmonic Exchange' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="flex items-center justify-between p-4 border-b">
          <nav className="space-x-4 text-sm">
            <Link href="/">Home</Link>
            <Link href="/browse">Browse</Link>
            <Link href="/offers/new">New Offer</Link>
            <Link href="/offers/mine">My Offers</Link>
            <Link href="/inbox">Inbox</Link>
            <Link href="/sign-in">Sign In</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/admin">Admin</Link>
          </nav>
          <NotificationsBell />
        </header>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}
