'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import TagMultiSelect from '@/components/TagMultiSelect';
import UploadImages from '@/components/UploadImages';

type Tag = { id: number; name: string };
type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other';

export default function NewOfferPage() {
  // form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [offerType, setOfferType] = useState<OfferType>('service');
  const [isOnline, setIsOnline] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  // tag source
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // ui state
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // load tags
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingTags(true);
      const { data, error } = await supabase
        .from('tags')
        .select('id, name')
        .order('name', { ascending: true });
      if (!cancel) {
        if (!error && data) setAllTags(data as Tag[]);
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
      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const userId = userRes.user?.id;
      if (!userId) throw new Error('You must be signed in.');

      // create offer
      const { data: inserted, error: insErr } = await supabase
        .from('offers')
        .insert({
          owner_id: userId,
          title,
          description,
          offer_type: offerType,
          is_online: isOnline,
          city: isOnline ? null : (city || null),
          country: isOnline ? null : (country || null),
          images,                 // <- IMAGE URLS SAVED HERE
          status: 'active',
        })
        .select('id')
        .single();

      if (insErr) throw insErr;
      const offerId = inserted!.id as string;

      // attach tags
      if (tags.length > 0) {
        const rows = tags.map((t) => ({ offer_id: offerId, tag_id: t.id }));
        const { error: tagErr } = await supabase.from('offer_tags').upsert(rows, { ignoreDuplicates: true });
        if (tagErr) throw tagErr;
      }

      setMsg('Offer created!');
      // reset light fields
      setTitle('');
      setDescription('');
      setIsOnline(false);
      setCity('');
      setCountry('');
      setTags([]);
      setImages([]);
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong creating the offer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="max-w-3xl">
      <h2 className="mb-3 text-2xl font-bold">New Offer</h2>

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

          <div className="sm:col-span-2 flex items-end gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isOnline}
                onChange={(e) => setIsOnline(e.target.checked)}
              />
              Online
            </label>

            {!isOnline && (
              <>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="grow rounded border px-3 py-2"
                />
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Country"
                  className="grow rounded border px-3 py-2"
                />
              </>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Tags</label>
          <TagMultiSelect
            allTags={allTags}
            value={tags}
            onChange={setTags}
            placeholder={loadingTags ? 'Loading tags…' : 'Type to search, press Enter to add'}
          />
          <p className="mt-1 text-xs text-gray-500">Tip: add a few relevant tags.</p>
        </div>

        {/* ✅ IMAGE UPLOADER (label is rendered inside the component) */}
        <UploadImages value={images} onChange={setImages} />

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create'}
        </button>

        {msg && <p className="text-sm text-green-700">{msg}</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>

      <div className="pt-4">
        <Link href="/offers" className="underline text-sm">
          ← Back to Browse
        </Link>
      </div>
    </section>
  );
}
