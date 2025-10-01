export default function StartChapterPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">Start a Chapter</h1>
      <p className="mt-4 text-[var(--hx-muted)]">
        Chapters begin small—two or three people aligned in values. Keep it human-scale and rhythmical. Below is a simple starter flow.
      </p>

      <ol className="mt-6 space-y-3">
        <li className="hx-card p-4"><b>1. Anchor team.</b> 2–4 people who care about the practice.</li>
        <li className="hx-card p-4"><b>2. Set cadence.</b> Choose a monthly meet or share circle.</li>
        <li className="hx-card p-4"><b>3. Invite.</b> Share the vision: gift-first, dignity, trust over tally.</li>
        <li className="hx-card p-4"><b>4. Document & reflect.</b> Capture learnings and iterate together.</li>
      </ol>

      <p className="mt-6 text-[var(--hx-muted)]">
        Want support? We’re happy to help with templates and facilitation tips.
      </p>
    </main>
  );
}
