'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TagMultiSelect from '@/components/TagMultiSelect';
import UploadImages from '@/components/UploadImages';

type OfferType = 'product' | 'service' | 'time' | 'knowledge' | 'other';
type Tag = { id: number; name: string };

export default function EditOfferPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  // fields
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

  // misc
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [origTagIds, setOrigTagIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const canSave = useMemo(() => !!title.trim(), [title]);

  // load tag options
  useEffect(() => {
    (async () => {
      setLoadingTags(true);
      const { data } = await supabase.from('tags').select('id,name').order('name', { ascending: true });
      setAllTags((data as Tag[]) ?? []);
      setLoadingTags(false);
    })();
  }, []);

  // load offer + verify ownership
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setMsg('');

      const [{ data: me }, { data, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from('offers')
          .select('id, owner_id, title, description, offer_type, is_online, city, country, images, offer_tags(tags(id,name))')
          .eq('id', id)
          .single(),
      ]);

      if (cancel) return;

      if (error || !data) {
        setMsg(error?.message || 'Offer not found.');
        setLoading(false);
        return;
      }

      const userId = me?.user?.id ?? null;
      if (!userId || data.owner_id !== userId) {
        setMsg('You do not have permission to edit this offer.');
        setLoading(false);
        return;
      }

      setOwnerId(userId);
      setTitle(data.title ?? '');
      setDescription(data.description ?? '');
      setOfferType(data.offer_type as OfferType);
      setIsOnline(!!data.is_online);
      setCity(data.city ?? '');
      setCountry(data.country ?? '');
      setImages((data.images as string[] | null) ?? []);

      const tagList: Tag[] =
        (data.offer_tags ?? [])
          .map((x: any) => x?.tags)
          .filter((t: any) => t?.id && t?.name)
          .map((t: any) => ({ id: t.id as number, name: t.name as string })) ?? [];
      setTags(tagList);
      setOrigTagIds(tagList.map(t => t.id));

      setLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, [id]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ownerId || !canSave) return;

    setSaving(true);
    setMsg('');

    try {
      // 1) update offer core fields
      const { error: updErr } = await supabase
        .from('offers')
        .update({
          title,
          description,
          offer_type: offerType,
          is_online: isOnline,
          city: isOnline ? null : (city || null),
          country: isOnline ? null : (country || null),
          images,
        })
        .eq('id', id)
        .select('id')
        .single();

      if (updErr) throw updErr;

      // 2) sync tags (insert new, delete removed)
      const nextIds = tags.map(t => t.id);
      const toAdd = nextIds.filter(x => !origTagIds.includes(x));
      const toRemove = origTagIds.filter(x => !nextIds.includes(x));

      if (toAdd.length) {
        const rows = toAdd.map(tag_id => ({ offer_id: id, tag_id }));
        const { error } = await supabase.from('offer_tags').upsert(rows, { ignoreDuplicates: true });
        if (error) throw error;
      }

      if (toRemove.length) {
        const { error } = await supabase.from('offer_tags')
          .delete()
          .eq('offer_id', id)
          .in('tag_id', toRemove);
        if (error) throw error;
      }

      setMsg('Saved!');
      setOrigTagIds(nextIds);
      // Optional: navigate back to detail or mine
      // router.push('/offers/mine')
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not save changes.');
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

  return (
    <section className="max-w-3xl">
      <Link href="/offers/mine" className="text-sm underline">
        &larr; Back to My Offers
      </Link>

      <h2 className="mt-2 text-2xl font-bold">Edit Offer</h2>

      {msg && <p className="mt-2 text-sm">{msg}</p>}

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
            value={tags}
            onChange={setTags}
            placeholder={loadingTags ? 'Loading tags…' : 'Type to search, press Enter to add'}
          />
          <p className="mt-1 text-xs text-gray-500">Tip: add a few relevant tags.</p>
        </div>

        <div>
          <label className="block text-sm font-medium">Images</label>
          <UploadImages value={images} onChange={setImages} />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!canSave || saving}
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>

          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => router.push('/offers/mine')}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
