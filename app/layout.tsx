import './globals.css'
import Link from 'next/link'
import NotificationsBell from '@/components/NotificationsBell'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-3">
            <div className="flex items-center gap-4">
              <Link href="/">Home</Link>
              <Link href="/offers">Browse</Link>
              <Link href="/offers/new">New Offer</Link>
              <Link href="/offers/mine">My Offers</Link>
              <Link href="/inbox">Inbox</Link>
              <Link href="/profile">Profile</Link>
              <Link href="/admin">Admin</Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/sign-in">Sign In</Link>
              <NotificationsBell />
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-4">{children}</main>
      </body>
    </html>
  )
}
