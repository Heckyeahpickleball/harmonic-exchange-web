import Link from "next/link";

export default function ChaptersPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Local Chapters</h1>
        <Link href="/chapters/start" className="hx-btn hx-btn--primary">Start a Chapter</Link>
      </div>

      <p className="mt-3 text-[var(--hx-muted)]">
        Chapters are local circles that host shares, gatherings, and experiments. Anyone can start one with a few friends.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="hx-card p-5">
          <div className="font-semibold">Ottawa, Canada</div>
          <p className="mt-1 text-[var(--hx-muted)]">Monthly share circles and pop-up offering markets.</p>
        </div>
        <div className="hx-card p-5">
          <div className="font-semibold">São Paulo, Brazil</div>
          <p className="mt-1 text-[var(--hx-muted)]">Community skill-shares and creative studios in flow.</p>
        </div>
      </div>
    </main>
  );
}
