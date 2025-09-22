'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

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
  created_at: string; // ✅ include this so TS is happy
};

export default function OfferDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;

  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(
          'id, owner_id, title, description, offer_type, is_online, city, country, images, status, created_at'
        )
        .eq('id', id)
        .single();

      if (!cancelled) {
        if (error) setMsg(error.message);
        setOffer((data ?? null) as OfferRow | null);
        setLoading(false);
      }
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
    if (!userRes.user) {
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

  return (
    <section className="max-w-3xl space-y-3">
      <h2 className="text-2xl font-bold">{offer.title}</h2>
      <p className="text-sm text-gray-600">
        {offer.offer_type} • {offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ')}
      </p>
      {offer.description && <p>{offer.description}</p>}

      <form onSubmit={submitRequest} className="mt-4 space-y-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          placeholder="Tell the owner what you need…"
          className="w-full rounded border p-2 min-h-[90px]"
        />
        <button disabled={sending} className="rounded bg-black px-4 py-2 text-white">
          {sending ? 'Sending…' : 'Request this Offer'}
        </button>
      </form>

      {msg && <p className="text-sm">{msg}</p>}

      <div className="pt-2">
        <Link href="/offers" className="underline text-sm">
          ← Back to Browse
        </Link>
      </div>
    </section>
  );
}
