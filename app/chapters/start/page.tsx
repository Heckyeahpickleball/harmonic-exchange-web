'use client';

import { useState } from 'react';
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

export default function StartChapterPage() {
  const router = useRouter();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [about, setAbout] = useState('');
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);

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

      // Auto-name: "Harmonic Exchange- {city}"
      const name = `Harmonic Exchange- ${city.trim()}`;

      // Predictable slug, prefer city-country
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

      // Insert (tolerates older schemas; PostgREST ignores unknown/missing cols)
      const insertPayload: any = {
        name,
        city,
        country,
        about: about || null,
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

      // Creator becomes anchor
      await supabase.from('group_members').insert({
        group_id: gRow.id,
        profile_id: auth.user.id,
        role: 'anchor',
      });

      // Go to the new chapter detail page (creator may view even if pending)
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
        {/* No name field — we auto-name as "Harmonic Exchange- {city}" */}
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
            className="mt-1 w-full rounded border px-3 py-2 min-h-[120px]"
            value={about}
            onChange={(e)=>setAbout(e.target.value)}
            placeholder="A few sentences about your chapter…"
          />
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

        {/* Preview of auto-name */}
        <p className="text-xs text-gray-600">
          Your chapter will be named <span className="font-mono">Harmonic Exchange- {city || 'City'}</span>.
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
