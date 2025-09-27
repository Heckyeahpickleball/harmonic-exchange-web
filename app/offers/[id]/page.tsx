// app/offers/[id]/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';

type Offer = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other';
  is_online: boolean;
  city: string | null;
  country: string | null;
  images: string[] | null;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
};

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [me, setMe] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number>(0);

  // load session + offer + eligibility
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancel) setMe(uid);

        // fetch the offer (RLS will allow: active for everyone, plus owner/admin/mod)
        const { data: o, error: oErr } = await supabase
          .from('offers')
          .select(
            'id, owner_id, title, description, offer_type, is_online, city, country, images, status, created_at'
          )
          .eq('id', id)
          .single();

        if (oErr) throw oErr;
        if (!cancel) setOffer(o as Offer);

        // eligibility: count of active offers for the viewer
        if (uid) {
          const { data: c } = await supabase
            .from('profile_active_offer_count')
            .select('active_offers')
            .eq('profile_id', uid)
            .maybeSingle(); // view row may not exist
          if (!cancel) setEligibleCount(c?.active_offers ?? 0);
        } else {
          if (!cancel) setEligibleCount(0);
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load offer.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const isOwner = useMemo(() => !!offer && me === offer.owner_id, [offer, me]);
  const canRequest = useMemo(() => {
    if (!offer) return false;
    if (isOwner) return false;
    if (offer.status !== 'active') return false;
    return eligibleCount > 0;
  }, [offer, isOwner, eligibleCount]);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!offer) return;
    if (!me) {
      setErr('Please sign in to request.');
      return;
    }
    if (!canRequest) return;

    setSending(true);
    setErr(null);
    try {
      // Try RPC if it exists (creates notification), else fall back to direct insert
      let requestId: string | null = null;

      const { data: rpcData, error: rpcErr } = await supabase.rpc('create_request', {
        p_offer: offer.id,
        p_note: note.trim() || '—',
      });

      if (!rpcErr && rpcData) {
        // RPC returns UUID (request id)
        requestId = typeof rpcData === 'string' ? rpcData : (rpcData as any);
      } else {
        // Direct insert (RLS enforces eligibility)
        const { data: ins, error: insErr } = await supabase
          .from('requests')
          .insert({
            offer_id: offer.id,
            requester_profile_id: me,
            note: note.trim() || '—',
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        requestId = ins!.id as string;
      }

      // go to messages thread (uses request id as thread)
      router.push(`/messages?thread=${requestId}`);
    } catch (e: any) {
      setErr(e?.message ?? 'Could not send request.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className="max-w-3xl">
        <p>Loading…</p>
      </section>
    );
  }
  if (err) {
    return (
      <section className="max-w-3xl">
        <p className="text-red-600">{err}</p>
        <p className="mt-2">
          <Link href="/offers" className="underline">
            ← Back to Browse
          </Link>
        </p>
      </section>
    );
  }
  if (!offer) {
    return (
      <section className="max-w-3xl">
        <p>Offer not found.</p>
        <p className="mt-2">
          <Link href="/offers" className="underline">
            ← Back to Browse
          </Link>
        </p>
      </section>
    );
  }

  const location = offer.is_online
    ? 'Online'
    : [offer.city, offer.country].filter(Boolean).join(', ');
  const thumb = Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null;

  return (
    <section className="max-w-3xl space-y-4">
      <Link href="/offers" className="text-sm underline">
        ← Back to Browse
      </Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{offer.title}</h1>
        {offer.status !== 'active' && (
          <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-700">
            {offer.status === 'pending' ? 'pending approval' : offer.status}
          </span>
        )}
      </div>

      <div className="relative h-64 w-full overflow-hidden rounded bg-gray-100">
        {thumb ? (
          <Image src={thumb} alt={offer.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">No image</div>
        )}
      </div>

      <div className="text-sm text-gray-600">
        {offer.offer_type} • {location || '—'}
      </div>

      {offer.description && <p className="whitespace-pre-wrap">{offer.description}</p>}

      {/* Request box */}
      {!isOwner && (
        <form onSubmit={handleRequest} className="space-y-2 rounded border p-3">
          <label className="block text-sm font-medium">Tell the owner what you need…</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded border px-3 py-2"
            rows={4}
            placeholder="Write a short note"
          />
          <div className="flex items-center justify-between">
            {!me ? (
              <span className="text-sm text-gray-600">Sign in to request.</span>
            ) : offer.status !== 'active' ? (
              <span className="text-sm text-gray-600">This offer isn’t active yet.</span>
            ) : eligibleCount < 1 ? (
              <span className="text-sm text-gray-600">
                You need at least one <b>active</b> offer to request.
              </span>
            ) : null}
            <button
              type="submit"
              disabled={!canRequest || sending}
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      )}

      {isOwner && (
        <div className="rounded border p-3 text-sm text-gray-600">
          You are the owner of this offer.
        </div>
      )}
    </section>
  );
}
