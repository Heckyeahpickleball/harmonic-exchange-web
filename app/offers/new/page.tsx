'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import TagMultiSelect from '@/components/TagMultiSelect';
import UploadImages from '@/components/UploadImages';
import { COUNTRIES, canonicalizeCountry } from '@/lib/countries';

type Tag = { id: number; name: string };
type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other';

// Curated tag catalog (auto-seeded into public.tags).
const EXTENDED_TAGS = [
  // Services
  'coaching','mentoring','therapy','listening','counseling','tutoring','teaching','editing','proofreading',
  'translation','legal-advice','tax-help','accounting','career-support','resume-review','job-search',
  // Education
  'education','workshops','classes','skill-share','study-group','language-exchange','music-lessons',
  // Wellness
  'yoga','meditation','breathwork','somatics','reiki','massage','nutrition','fitness','qigong',
  // Tech & creative
  'web-development','design','ux','ui','branding','copywriting','photography','video','audio','podcasting',
  'illustration','3d','ai-art','no-code','automation','data','analytics','devops','it-support',
  // Home & community
  'childcare','pet-care','house-sitting','garden','composting','repair','handyman','cooking','baking',
  'food-share','rideshare','moving-help',
  // Products & making
  'handmade','art','prints','zines','crafts','jewelry','woodworking','ceramics','clothing','upcycling',
  // Presence & gifts
  'presence','listening-circle','peer-support','circle-facilitation','conflict-resolution','mediation',
  // Online / remote
  'remote','online','asynchronous',
  // Misc
  'events','organizing','community-building','fundraising','grant-writing'
];

function titleCaseCity(s: string) {
  return s
    .toLowerCase()
    .split(/[\s-]+/)
    .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/\b(And|Of|The|De|Da|La|Le|Van|Von)\b/g, (m) => m.toLowerCase());
}

export default function NewOfferPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('service');
  const [isOnline, setIsOnline] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // Prefill from profile + seed tags
  useEffect(() => {
    let cancel = false;
    (async () => {
      // Prefill
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (uid) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('country, city')
          .eq('id', uid)
          .maybeSingle();
        if (!cancel && prof) {
          const ctry = canonicalizeCountry(prof.country);
          setCountry(ctry || '');
          setCity(prof.city ? titleCaseCity(prof.city) : '');
        }
      }

      // Seed + load tags
      setLoadingTags(true);
      const { data: existing } = await supabase.from('tags').select('id, name');
      const existingNames = new Set((existing || []).map(t => String(t.name).toLowerCase()));
      const toInsert = EXTENDED_TAGS
        .filter(n => !existingNames.has(n.toLowerCase()))
        .map(n => ({ name: n }));
      if (toInsert.length > 0) {
        await supabase.from('tags').upsert(toInsert, { onConflict: 'name' });
      }
      const { data: finalList } = await supabase
        .from('tags')
        .select('id, name')
        .order('name', { ascending: true });
      if (!cancel) {
        setAllTags((finalList || []) as Tag[]);
        setLoadingTags(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr('');
    setMsg('');
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error('You must be signed in.');

      const normalizedCity = isOnline ? null : (city ? titleCaseCity(city.trim()) : null);
      const normalizedCountry = isOnline ? null : canonicalizeCountry(country) ?? null;

      const { data: inserted, error: insErr } = await supabase
        .from('offers')
        .insert({
          owner_id: userId,
          title: title.trim(),
          description: description.trim() || null,
          offer_type: offerType,
          is_online: isOnline,
          city: normalizedCity,
          country: normalizedCountry,
          images,
          status: 'pending',
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const offerId = inserted!.id as string;

      if (tags.length > 0) {
        const rows = tags.map(t => ({ offer_id: offerId, tag_id: t.id }));
        const { error: tagErr } = await supabase
          .from('offer_tags')
          .upsert(rows, { ignoreDuplicates: true });
        if (tagErr) throw tagErr;
      }

      router.push(`/offers/${offerId}`);
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong creating the offering.');
    } finally {
      setSubmitting(false);
    }
  }

  const locationHelper = isOnline
    ? 'Online offering — no location needed.'
    : 'Set your country and normalized city so this appears in the matching chapter.';

  return (
    <section className="max-w-3xl">
      <h2 className="mb-3 text-2xl font-bold">Share Your Gifts</h2>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">Type</label>
            <select
              value={offerType}
              onChange={(e) => setOfferType(e.target.value as OfferType)}
              className="w-full rounded border px-3 py-2"
            >
              <option value="product">product</option>
              <option value="service">service</option>
              <option value="time">time</option>
              <option value="knowledge">knowledge</option>
              <option value="other">other</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
              />
              Online
            </label>

            {/* Location (hidden when Online) */}
            {!isOnline && (
              <>
                {/* Country with type-ahead */}
                <div className="grow">
                  <label className="block text-xs text-gray-600">Country</label>
                  <input
                    list="hx-countries"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Start typing to search…"
                    className="w-full rounded border px-3 py-2"
                  />
                  <datalist id="hx-countries">
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>

                {/* City (normalize on blur) */}
                <div className="grow">
                  <label className="block text-xs text-gray-600">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    onBlur={() => setCity((c) => titleCaseCity(c))}
                    placeholder="City"
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              </>
            )}
          </div>
          <p className="sm:col-span-3 text-xs text-gray-500">{locationHelper}</p>
        </div>

        <div>
          <label className="block text-sm font-medium">Tags</label>
          <TagMultiSelect
            allTags={allTags}
            value={tags}
            onChange={setTags}
            placeholder={loadingTags ? 'Loading tags…' : 'Type to search, press Enter to add'}
          />
          <p className="mt-1 text-xs text-gray-500">
            Add a few relevant tags (e.g., coaching, education, childcare, web-development).
          </p>
        </div>

        <UploadImages value={images} onChange={setImages} />

        <button
          type="submit"
          disabled={submitting}
          className="hx-btn hx-btn--primary disabled:opacity-50"
        >
          {submitting ? 'Sharing…' : 'Share Your Gifts'}
        </button>

        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      <div className="pt-4">
        <Link href="/offers" className="hx-btn hx-btn--outline-primary text-sm">
          ← Back to Offerings
        </Link>
      </div>
    </section>
  );
}
