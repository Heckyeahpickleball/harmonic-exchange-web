'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabaseClient';
import RequestModal from '@/components/RequestModal';
import OfferGratitude from '@/components/OfferGratitude';

type Offer = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  offer_type: 'product' | 'service' | 'time' | 'knowledge' | 'other';
  is_online: boolean | null;
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
  const [err, setErr] = useState<string | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number>(0);

  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? null;
        if (!cancel) setMe(uid);

        const { data: o, error: oErr } = await supabase
          .from('offers')
          .select(
            'id, owner_id, title, description, offer_type, is_online, city, country, images, status, created_at'
          )
          .eq('id', id)
          .single();

        if (oErr) throw oErr;
        if (!cancel) setOffer(o as Offer);

        if (uid) {
          const { data: c } = await supabase
            .from('profile_active_offer_count')
            .select('active_offers')
            .eq('profile_id', uid)
            .maybeSingle();
          if (!cancel) setEligibleCount(c?.active_offers ?? 0);
        } else {
          if (!cancel) setEligibleCount(0);
        }
      } catch (e: any) {
        if (!cancel) setErr(e?.message ?? 'Failed to load offering.');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id]);

  const isOwner = useMemo(() => !!offer && me === offer?.owner_id, [offer, me]);
  const canAsk = useMemo(() => {
    if (!offer) return false;
    if (isOwner) return false;
    if (offer.status !== 'active') return false;
    return eligibleCount > 0;
  }, [offer, isOwner, eligibleCount]);

  async function createRequest(note: string) {
    if (!offer || !me) return;

    let requestId: string | null = null;

    // 1) Try the RPC
    const rpc = await supabase.rpc('create_request', {
      p_offer: offer.id,
      p_note: note.trim() || '—',
    });

    if (!rpc.error && rpc.data) {
      requestId =
        typeof rpc.data === 'string' ? rpc.data : (rpc.data as any);
    } else {
      // 2) Handle duplicate or fall back to direct insert
      const errMsg = rpc.error?.message ?? '';
      const duplicate = /duplicate key value|already exists|conflict/i.test(errMsg);

      if (duplicate) {
        const { data: existing, error: exErr } = await supabase
          .from('requests')
          .select('id')
          .eq('offer_id', offer.id)
          .eq('requester_profile_id', me)
          .maybeSingle();
        if (exErr) throw exErr;
        requestId = existing?.id ?? null;
      } else {
        const ins = await supabase
          .from('requests')
          .insert({
            offer_id: offer.id,
            requester_profile_id: me,
            note: note.trim() || '—',
          })
          .select('id')
          .maybeSingle();

        if (ins.error) {
          const dupe2 = /duplicate key value|already exists|conflict/i.test(ins.error.message);
          if (!dupe2) throw ins.error;

          const { data: existing2, error: exErr2 } = await supabase
            .from('requests')
            .select('id')
            .eq('offer_id', offer.id)
            .eq('requester_profile_id', me)
            .maybeSingle();
          if (exErr2) throw exErr2;
          requestId = existing2?.id ?? null;
        } else {
          requestId = ins.data?.id ?? null;
        }
      }
    }

    if (requestId) {
      // 3) Write BOTH sides of the initial message into notifications
      const payload = {
        thread_id: requestId,        // used by deep-linking
        request_id: requestId,
        offer_id: offer.id,
        sender_id: me,
        text: note.trim() || '—',
      };

      try {
        const now = new Date().toISOString();
        await supabase.from('notifications').insert([
          // Sender copy so you immediately see the message in your own thread
          { profile_id: me, type: 'message', data: payload, read_at: now },
          // Receiver copy so the owner is notified
          { profile_id: offer.owner_id, type: 'message_received', data: payload },
        ]);
      } catch {
        // non-fatal; chat will still open
      }
    }

    // 4) Navigate to the message thread
    try {
      router.push(requestId ? `/messages?request=${requestId}` : '/messages');
    } catch {
      // ignore
    }
  }

  if (loading) return <section className="max-w-3xl"><p>Loading…</p></section>;
  if (err) {
    return (
      <section className="max-w-3xl">
        <p className="text-red-600">{err}</p>
        <p className="mt-2"><Link href="/offers" className="underline">← Back to Offerings</Link></p>
      </section>
    );
  }
  if (!offer) {
    return (
      <section className="max-w-3xl">
        <p>Offering not found.</p>
        <p className="mt-2"><Link href="/offers" className="underline">← Back to Offerings</Link></p>
      </section>
    );
  }

  const location =
    offer.is_online ? 'Online' : [offer.city, offer.country].filter(Boolean).join(', ') || '—';
  const thumb =
    Array.isArray(offer.images) && offer.images.length > 0 ? offer.images[0] : null;

  return (
    <section className="max-w-3xl space-y-4">
      <Link href="/offers" className="text-sm underline">← Back to Offerings</Link>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{offer.title}</h1>

        <div className="flex items-center gap-2">
          <Link
            href={`/u/${offer.owner_id}`}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            View Provider
          </Link>

          {offer.status !== 'active' && (
            <span className="rounded bg-gray-200 px-2 py-0.5 text-[11px] uppercase tracking-wide text-gray-700">
              {offer.status === 'pending' ? 'pending approval' : offer.status}
            </span>
          )}
        </div>
      </div>

      <div className="relative h-64 w-full overflow-hidden rounded bg-gray-100">
        {thumb ? (
          <Image src={thumb} alt={offer.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}
      </div>

      <div className="text-sm text-gray-600">
        {offer.offer_type} • {location}
      </div>

      {offer.description && <p className="whitespace-pre-wrap">{offer.description}</p>}

      {/* ASK-TO-RECEIVE SECTION */}
      {!isOwner && (
        <div className="hx-card p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">
              {!me ? (
                <>
                  Please <Link href="/sign-in" className="hx-link">sign in</Link> to ask.
                </>
              ) : offer.status !== 'active' ? (
                <>This offering isn’t active yet.</>
              ) : eligibleCount < 1 ? (
                <>
                  To keep the circle generous, share at least one <b>active</b> gift first.{' '}
                  <Link href="/offers/new" className="hx-link">Share Your Gifts</Link>.
                </>
              ) : (
                <>Ready to ask?</>
              )}
            </div>

            <button
              type="button"
              disabled={!canAsk}
              onClick={() => setShowModal(true)}
              className="hx-btn hx-btn--primary disabled:opacity-50"
              aria-label="Ask to Receive"
            >
              Ask to Receive
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="rounded border p-3 text-sm text-gray-600">
          You are the owner of this offering.
        </div>
      )}

      {/* GRATITUDE */}
      <OfferGratitude offerId={offer.id} offerTitle={offer.title} limit={3} />

      {showModal && (
        <RequestModal
          title="Ask to Receive"
          placeholder="Share context and what you’re hoping for…"
          submitLabel="Ask to Receive"
          onCancel={() => setShowModal(false)}
          onSubmit={async (note, setBusy, setError) => {
            if (setBusy) setBusy(true);
            if (setError) setError('');
            try {
              await createRequest(note);
            } catch (e: any) {
              if (setError) setError(e?.message ?? 'Could not send your ask.');
              if (setBusy) setBusy(false);
              return;
            }
          }}
        />
      )}
    </section>
  );
}
