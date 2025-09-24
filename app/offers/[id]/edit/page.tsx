'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import TagMultiSelect from '@/components/TagMultiSelect';
import UploadImages from '@/components/UploadImages';

type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other';
type SimpleTag = { id: number; name: string };

type OfferRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  offer_type: OfferType;
  is_online: boolean;
  city: string | null;
  country: string | null;
  images: string[] | null;
  status: 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
  tags?: SimpleTag[];
};

export default function EditOfferPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const [viewerId, setViewerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>('');

  // form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState<string>('');
  const [offerType, setOfferType] = useState<OfferType>('service');
  const [isOnline, setIsOnline] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [status, setStatus] = useState<'active' | 'paused' | 'archived' | 'blocked'>('active');

  // tags
  const [allTags, setAllTags] = useState<SimpleTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<SimpleTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(true);

  // load viewer
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancel) setViewerId(data.user?.id ?? null);
    })();
    return () => { cancel = true; };
  }, []);

  // load all tag options
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingTags(true);
      const { data, error } = await supabase.from('tags').select('id,name').order('name');
      if (!cancel) {
        if (!error && data) setAllTags(data as SimpleTag[]);
        setLoadingTags(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  // load offer + its tags
  useEffect(() => {
    let cancel = false;

    (async () => {
      setLoading(true);
      setMsg('');

      const { data, error } = await supabase
        .from('offers')
        .select(`
          id, owner_id, title, description, offer_type, is_online, city, country, images, status, created_at,
          offer_tags:offer_tags ( tags:tags ( id, name ) )
        `)
        .eq('id', id)
        .single();

      if (cancel) return;

      if (error || !data) {
        setMsg(error?.message || 'Offer not found.');
        setLoading(false);
        return;
      }

      const raw = data as any;
      const tags: SimpleTag[] =
        (raw.offer_tags ?? [])
          .map((x: any) => x?.tags)
          .filter((t: any) => t && typeof t.id === 'number' && typeof t.name === 'string')
          .map((t: any) => ({ id: t.id as number, name: t.name as string }));

      // only owner can edit
      const mine = raw.owner_id === (await supabase.auth.getUser()).data.user?.id;
      if (!mine) {
        setMsg('You do not have permission to edit this offer.');
        setLoading(false);
        return;
      }

      setTitle(raw.title ?? '');
      setDescription(raw.description ?? '');
      setOfferType(raw.offer_type as OfferType);
      setIsOnline(!!raw.is_online);
      setCity(raw.city ?? '');
      setCountry(raw.country ?? '');
      setImages(Array.isArray(raw.images) ? raw.images : []);
      setStatus(raw.status);
      setSelectedTags(tags);

      setLoading(false);
    })();

    return () => { cancel = true; };
  }, [id]);

  const canSave = useMemo(() => {
    if (!viewerId) return false;
    if (!title.trim()) return false;
    return true;
  }, [viewerId, title]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;

    setSaving(true);
    setMsg('');

    try {
      // 1) Update the offer
      const patch = {
        title: title.trim(),
        description: description || null,
        offer_type: offerType,
        is_online: isOnline,
        city: isOnline ? null : (city || null),
        country: isOnline ? null : (country || null),
        images, // from UploadImages value (we persist whole array)
        status,
      };

      const { error: updErr } = await supabase
        .from('offers')
        .update(patch)
        .eq('id', id)
        .select('id')
        .single();

      if (updErr) throw updErr;

      // 2) Replace tag links (simple: delete all + insert current)
      //    If you later enable RLS on offer_tags, add appropriate policies.
      const tagIds = selectedTags.map(t => t.id);

      // delete all links for this offer
      await supabase.from('offer_tags').delete().eq('offer_id', id);
      // insert selected
      if (tagIds.length > 0) {
        const rows = tagIds.map(tag_id => ({ offer_id: id, tag_id }));
        const { error: insErr } = await supabase.from('offer_tags').insert(rows);
        if (insErr) throw insErr;
      }

      setMsg('Saved!');
    } catch (err: any) {
      setMsg(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="max-w-3xl">
        <p>Loading…</p>
      </section>
    );
  }

  if (!viewerId) {
    return (
      <section className="max-w-3xl">
        <p>Please sign in to edit your offer.</p>
        <div className="pt-2">
          <Link href="/sign-in" className="underline text-sm">Go to sign in</Link>
        </div>
      </section>
    );
  }

  if (msg && msg.includes('permission')) {
    return (
      <section className="max-w-3xl">
        <p>{msg}</p>
        <div className="pt-2">
          <Link href={`/offers/${id}`} className="underline text-sm">← Back to offer</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl">
      <div className="mb-2">
        <Link href={`/offers/${id}`} className="text-sm underline">
          &larr; Back to Offer
        </Link>
      </div>

      <h1 className="text-2xl font-bold">Edit Offer</h1>

      <form onSubmit={onSave} className="mt-4 space-y-4">
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
            value={selectedTags}
            onChange={setSelectedTags}
            placeholder={loadingTags ? 'Loading tags…' : 'Type to search, press Enter to add'}
          />
          <p className="mt-1 text-xs text-gray-500">Tip: add a few relevant tags.</p>
        </div>

        <div>
          <UploadImages value={images} onChange={setImages} />
          <p className="mt-1 text-xs text-gray-500">
            Removing a thumbnail deletes it from storage; changes are saved when you click <b>Save</b>.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="w-full rounded border px-3 py-2"
          >
            <option value="active">active</option>
            <option value="paused">paused</option>
            <option value="archived">archived</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={!canSave || saving}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </section>
  );
}
