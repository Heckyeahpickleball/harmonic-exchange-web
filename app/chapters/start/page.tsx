'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

// Recommended About template; we lightly interpolate the city if provided.
function buildRecommendedAbout(city?: string, country?: string) {
  const where = [city?.trim(), country?.trim()].filter(Boolean).join(', ');
  return (
`Harmonic Exchange is a gift-first community practicing a post-currency way of sharing value. We offer time, skills, products, services, education, coaching, presence, and creativity — freely given and received with dignity.

This circle${where ? ` in ${where}` : ''} meets regularly to host share circles, skill-shares, and community projects. We keep it human-scale, inclusive, and rhythmical. Participation is voluntary and anchored in trust, responsibility, and care.

New members are welcome to observe, share, or simply be present. Come as you are.`
  );
}

export default function StartChapterPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Start with our recommended text; keep it editable.
  const [about, setAbout] = useState(buildRecommendedAbout('', ''));
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Live preview of auto-name
  const autoName = useMemo(() => `Harmonic Exchange- ${city || 'City'}`, [city]);

  // If the user clicks "Use recommended", rebuild using current city/country.
  function resetAboutToRecommended() {
    setAbout(buildRecommendedAbout(city, country));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');

    if (!agree) { setMsg('Please agree to the anchor commitment.'); return; }
    if (!city || !country) { setMsg('City and country are required.'); return; }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent('/chapters/start'));
        return;
      }

      // Auto-name
      const name = `Harmonic Exchange- ${city.trim()}`;

      // Predictable unique slug: city-country[-n]
      const baseSlug = slugify(`${city}-${country}`);
      let finalSlug = baseSlug;
      for (let i = 0; i < 12; i++) {
        const { data: exists } = await supabase
          .from('groups')
          .select('id')
          .eq('slug', finalSlug)
          .maybeSingle();
        if (!exists) break;
        finalSlug = `${baseSlug}-${i + 2}`;
      }

      const insertPayload: any = {
        name,
        city,
        country,
        about: about && about.trim().length ? about.trim() : null,
        slug: finalSlug,
        type: 'chapter',
        created_by: auth.user.id,
        anchor_agreed_at: new Date().toISOString(),
        status: 'pending', // tolerated if column exists; ignored if not
      };

      const { data: gRow, error: gErr } = await supabase
        .from('groups')
        .insert(insertPayload)
        .select('id,slug')
        .single();
      if (gErr) throw gErr;

      // Creator becomes anchor
      await supabase.from('group_members').insert({
        group_id: gRow.id,
        profile_id: auth.user.id,
        role: 'anchor',
      });

      // Redirect to chapter (creator can view even if pending)
      router.push(`/chapters/${gRow.slug}`);
    } catch (err: any) {
      console.error(err);
      setMsg(err?.message ?? 'Failed to create chapter.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Start a Chapter</h1>
      <p className="mt-3 text-[var(--hx-muted)]">
        Chapters begin small—two or three people aligned in values. Keep it human-scale and rhythmical.
      </p>

      <form onSubmit={onSubmit} className="mt-8 hx-card p-5 space-y-4">
        {/* No "name" field — auto-named as "Harmonic Exchange- {city}" */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">City</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={city}
              onChange={(e)=>setCity(e.target.value)}
              placeholder="Ottawa"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Country</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={country}
              onChange={(e)=>setCountry(e.target.value)}
              placeholder="Canada"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">About</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2 min-h-[160px]"
            value={about}
            onChange={(e)=>setAbout(e.target.value)}
            placeholder="A few sentences about your chapter…"
          />
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-xs text-gray-600">
              This is the recommended About text. You can edit or delete it. Final copy is subject to admin approval.
            </p>
            <button
              type="button"
              onClick={resetAboutToRecommended}
              className="ml-auto hx-btn hx-btn--outline-primary text-xs px-2 py-1"
              title="Restore the suggested About text"
            >
              Use recommended
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e)=>setAgree(e.target.checked)} />
          <span>I agree to anchor with a gift-first spirit and uphold community agreements.</span>
        </label>

        {msg && <p className="text-sm text-amber-700">{msg}</p>}

        <div className="pt-2">
          <button className="hx-btn hx-btn--primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit for Approval'}
          </button>
        </div>

        {/* Live preview of the auto-name */}
        <p className="text-xs text-gray-600">
          Your chapter will be named <span className="font-mono">{autoName}</span>.
        </p>
      </form>

      <div className="mt-8 grid gap-3">
        <div className="hx-card p-4"><strong>1. Anchor team.</strong> 2–4 people who care about the practice.</div>
        <div className="hx-card p-4"><strong>2. Set cadence.</strong> Choose a monthly meet or share circle.</div>
        <div className="hx-card p-4"><strong>3. Invite.</strong> Share the vision: gift-first, dignity, trust over tally.</div>
        <div className="hx-card p-4"><strong>4. Document &amp; reflect.</strong> Capture learnings and iterate together.</div>
      </div>
    </main>
  );
}
