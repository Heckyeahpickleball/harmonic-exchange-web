'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { COUNTRIES, canonicalizeCountry } from '@/lib/countries';

function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

function buildRecommendedAbout(city?: string, country?: string) {
  const where = [city?.trim(), country?.trim()].filter(Boolean).join(', ');
  return (
`Harmonic Exchange is a gift-first community practicing a post-currency way of sharing value. We offer time, skills, products, services, education, coaching, presence, and creativity — freely given and received with dignity.

This circle${where ? ` in ${where}` : ''} meets regularly to host share circles, skill-shares, and community projects. We keep it human-scale, inclusive, and rhythmical. Participation is voluntary and anchored in trust, responsibility, and care.

New members are welcome to observe, share, or simply be present. Come as you are.`
  );
}

function titleCaseCity(s: string) {
  return s
    .toLowerCase()
    .split(/[\s-]+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/\b(And|Of|The|De|Da|La|Le|Van|Von)\b/g, (m) => m.toLowerCase());
}

export default function StartChapterPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [about, setAbout] = useState(buildRecommendedAbout('', ''));
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);

  // Prefill from profile
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('country, city')
        .eq('id', uid)
        .maybeSingle();
      if (!cancel && prof) {
        const ctry = canonicalizeCountry(prof.country);
        const cty = prof.city ? titleCaseCity(prof.city) : '';
        setCountry(ctry || '');
        setCity(cty);
        setAbout(buildRecommendedAbout(cty, ctry || undefined));
      }
    })();
    return () => { cancel = true; };
  }, []);

  // Live preview of auto-name
  const autoName = useMemo(() => `Harmonic Exchange — ${city || 'City'}`, [city]);

  function resetAboutToRecommended() {
    setAbout(buildRecommendedAbout(city, country));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');

    if (!agree) { setMsg('Please agree to the anchor commitment.'); return; }
    if (!country) { setMsg('Country is required.'); return; }
    if (!city) { setMsg('City is required.'); return; }

    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.push('/signin?next=' + encodeURIComponent('/chapters/start'));
        return;
      }

      const normalizedCity = titleCaseCity(city.trim());
      const normalizedCountry = canonicalizeCountry(country) ?? country.trim();

      // Auto-name uses the normalized city
      const name = `Harmonic Exchange — ${normalizedCity}`;

      // slug: city-country lowercased (predictable)
      const baseSlug = slugify(`${normalizedCity}-${normalizedCountry}`);
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
        city: normalizedCity,
        country: normalizedCountry,
        about: about && about.trim().length ? about.trim() : null,
        slug: finalSlug,
        type: 'chapter',
        created_by: auth.user.id,
        anchor_agreed_at: new Date().toISOString(),
        status: 'pending',
      };

      const { data: gRow, error: gErr } = await supabase
        .from('groups')
        .insert(insertPayload)
        .select('id,slug')
        .single();
      if (gErr) throw gErr;

      await supabase.from('group_members').insert({
        group_id: gRow.id,
        profile_id: auth.user.id,
        role: 'anchor',
      });

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
        {/* Country first (type-ahead), then City (normalized) */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Country</label>
            <input
              list="hx-countries"
              className="mt-1 w-full rounded border px-3 py-2"
              value={country}
              onChange={(e)=>setCountry(e.target.value)}
              placeholder="Start typing to search…"
              required
            />
            <datalist id="hx-countries">
              {COUNTRIES.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">City</label>
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={city}
              onChange={(e)=>setCity(e.target.value)}
              onBlur={() => setCity(c => titleCaseCity(c))}
              placeholder="Start typing your city (e.g., Ottawa)"
              required
            />
            <p className="mt-1 text-xs text-gray-600">
              We normalize city names (e.g., “new york” → “New York”) so your offers map to the correct chapter.
            </p>
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
