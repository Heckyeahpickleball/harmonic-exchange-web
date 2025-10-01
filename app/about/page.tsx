export default function AboutPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold">About the Movement</h1>
      <p className="mt-4 text-[var(--hx-muted)]">
        Harmonic Exchange is a living experiment in a post-currency, gift-first, resonance-based way of sharing value.
        We’re prototyping a new kind of economy—built from the heart outward—where offerings may be time, products,
        services, presence, or creativity, shared without obligation and received with dignity.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="hx-card p-5">
          <div className="font-semibold">What we value</div>
          <p className="mt-1 text-[var(--hx-muted)]">Gift-first energy, dignity-centered receiving, trust over tally, flow over force, human-scale interactions.</p>
        </div>
        <div className="hx-card p-5">
          <div className="font-semibold">How we learn</div>
          <p className="mt-1 text-[var(--hx-muted)]">By doing. We iterate in public, reflect together, and evolve the practice as a community.</p>
        </div>
      </div>
    </main>
  );
}
