'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type SimpleTag = { id: number; name: string };

type OfferRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other';
  is_online: boolean;
  city: string | null;
  country: string | null;
  images: string[] | null;
  status: 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
  tags?: SimpleTag[];
};

export default function OfferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = params.id;

  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('offers')
        .select(
          // pull the offer and (optionally) nested tags
          'id, owner_id, title, description, offer_type, is_online, city, country, images, status, created_at, offer_tags ( tags ( id, name ) )'
        )
        .eq('id', id)
        .single();

      if (cancelled) return;

      if (error) {
        setMsg(error.message);
        setOffer(null);
      } else if (data) {
        // tolerant mapping of nested tags without importing any global Tag type
        const raw = data as any;
        const tags: SimpleTag[] =
          (raw.offer_tags ?? [])
            .map((x: any) => x?.tags)
            .filter((t: any) => t && typeof t.id === 'number' && typeof t.name === 'string')
            .map((t: any) => ({ id: t.id as number, name: t.name as string })) ?? [];

        const mapped: OfferRow = {
          id: raw.id,
          owner_id: raw.owner_id,
          title: raw.title,
          description: raw.description ?? null,
          offer_type: raw.offer_type,
          is_online: !!raw.is_online,
          city: raw.city ?? null,
          country: raw.country ?? null,
          images: Array.isArray(raw.images) ? (raw.images as string[]) : [],
          status: raw.status,
          created_at: raw.created_at,
          tags,
        };

        setOffer(mapped);
      } else {
        setOffer(null);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!offer) return;

    setSending(true);
    setMsg('');

    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      setMsg('Please sign in first.');
      setSending(false);
      return;
    }

    const { error } = await supabase
      .from('requests')
      .insert({
        offer_id: offer.id,
        requester_profile_id: userRes.user.id,
        note,
      })
      .select('id')
      .single();

    if (error) setMsg(error.message);
    else setMsg('Request sent!');

    setSending(false);
  }

  if (loading) {
    return (
      <section className="max-w-3xl">
        <p>Loading…</p>
      </section>
    );
  }

  if (!offer) {
    return (
      <section className="max-w-3xl">
        <p>Offer not found.</p>
        <div className="pt-2">
          <Link href="/offers" className="underline text-sm">
            ← Back to Browse
          </Link>
        </div>
      </section>
    );
  }

  const images: string[] = offer.images ?? [];
  const hero = images[0] ?? null;
  const location = offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ');

  return (
    <section className="max-w-3xl">
      <Link href="/offers" className="text-sm underline">
        &larr; Back to Browse
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{offer.title}</h1>
      <div className="text-sm text-gray-600">
        {offer.offer_type} • {location || '—'}
      </div>

      {hero && (
        <div className="mt-4 overflow-hidden rounded border">
          <img src={hero} alt={offer.title} className="h-72 w-full object-cover" />
        </div>
      )}

      {images.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {images.slice(1).map((u) => (
            <img key={u} src={u} alt="thumbnail" className="h-16 w-16 rounded object-cover border" />
          ))}
        </div>
      )}

      {offer.tags && offer.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {offer.tags.map((t) => (
            <span key={t.id} className="rounded bg-gray-100 px-2 py-[2px] text-[11px]">
              {t.name}
            </span>
          ))}
        </div>
      )}

      {offer.description && <p className="mt-4 whitespace-pre-wrap">{offer.description}</p>}

      <form onSubmit={submitRequest} className="mt-6">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          placeholder="Tell the owner what you need…"
          className="w-full rounded border p-2 min-h-[90px]"
        />
        <button disabled={sending} className="mt-3 rounded bg-black px-4 py-2 text-white disabled:opacity-60">
          {sending ? 'Sending…' : 'Send request'}
        </button>
      </form>

      {msg && <p className="mt-2 text-sm">{msg}</p>}
    </section>
  );
}
