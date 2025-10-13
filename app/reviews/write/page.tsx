'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

export default function WriteGratitudePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const requestId = sp.get('request_id');

  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerTitle, setOfferTitle] = useState<string>('Offer');
  const [ownerName, setOwnerName] = useState<string>('Provider');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth?.user?.id ?? null;
        if (!uid || !requestId) {
          setError('Missing request or not signed in.');
          setLoading(false);
          return;
        }
        setMe(uid);

        // Load request + offer + provider/receiver to validate permissions
        const { data: req } = await supabase
          .from('requests')
          .select('id, offer_id, requester_profile_id, status, updated_at')
          .eq('id', requestId)
          .maybeSingle();

        if (!req) {
          setError('Request not found.');
          setLoading(false);
          return;
        }

        if (req.requester_profile_id !== uid) {
          setError('Only the receiver can write this gratitude.');
          setLoading(false);
          return;
        }

        // Optional: block if already posted
        const { data: existing } = await supabase
          .from('review_gratitudes')
          .select('id')
          .eq('request_id', requestId)
          .maybeSingle();
        if (existing) {
          router.replace('/reviews');
          return;
        }

        // Offer title + provider
        const [{ data: offer }, { data: owner }] = await Promise.all([
          supabase.from('offers').select('id,title,owner_id').eq('id', req.offer_id).maybeSingle(),
          supabase.from('profiles').select('id,display_name').eq('id', req.requester_profile_id).maybeSingle(), // fall back; owner loaded below
        ]);

        if (offer) {
          setOfferTitle(offer.title ?? 'Offer');
          const { data: prov } = await supabase
            .from('profiles').select('display_name').eq('id', offer.owner_id).maybeSingle();
          setOwnerName(prov?.display_name ?? 'Provider');
        }

      } catch (e: any) {
        setError(e?.message ?? 'Could not load request.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [requestId, router]);

  async function submit() {
    setError('');
    if (!message || message.trim().length < 6) {
      setError('Please share a short note of gratitude (at least 6 characters).');
      return;
    }
    try {
      // re-fetch the request to get all foreign keys safely
      const { data: req, error: rErr } = await supabase
        .from('requests')
        .select('id, offer_id, requester_profile_id')
        .eq('id', requestId)
        .single();
      if (rErr || !req) throw rErr ?? new Error('Request not found');

      const { data: offer } = await supabase
        .from('offers')
        .select('id, owner_id')
        .eq('id', req.offer_id)
        .single();

      const { error: insErr } = await supabase.from('review_gratitudes').insert({
        request_id: req.id,
        offer_id: req.offer_id,
        owner_profile_id: offer?.owner_id,
        receiver_profile_id: req.requester_profile_id,
        message: message.trim(),
      });
      if (insErr) throw insErr;

      router.replace('/reviews');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save gratitude.');
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="text-2xl font-bold">Share Gratitude</h1>

      {loading && <p className="text-sm text-gray-600">Loading…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {!loading && !error && (
        <div className="hx-card p-4">
          <p className="text-sm text-gray-700">
            You received <span className="font-semibold">“{offerTitle}”</span> from{' '}
            <span className="font-semibold">{ownerName}</span>. If you’d like, share a short note of gratitude or the
            outcome of your exchange.
          </p>

          <textarea
            className="mt-3 w-full rounded border p-3"
            rows={6}
            maxLength={4000}
            placeholder="What happened? How did it feel? What are you grateful for?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          <div className="mt-3 flex items-center gap-2">
            <button onClick={submit} className="hx-btn hx-btn--primary">Publish</button>
            <Link href="/reviews" className="hx-btn hx-btn--secondary">Cancel</Link>
          </div>
        </div>
      )}
    </section>
  );
}
