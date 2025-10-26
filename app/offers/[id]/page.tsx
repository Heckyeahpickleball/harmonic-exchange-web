'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();

  const [me, setMe] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [eligibleCount, setEligibleCount] = useState<number>(0);

  const [showModal, setShowModal] = useState(false);
  const [autoAskHandled, setAutoAskHandled] = useState(false);

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
  const canOpenModal = useMemo(() => {
    if (!offer) return false;
    if (isOwner) return false;
    if (offer.status !== 'active') return false;
    if (!me) return false;
    return eligibleCount > 0;
  }, [offer, isOwner, me, eligibleCount]);

  const canAsk = useMemo(() => {
    if (!offer) return false;
    if (isOwner) return false;
    if (offer.status !== 'active') return false;
    if (!me) return true;
    return eligibleCount > 0;
  }, [offer, isOwner, me, eligibleCount]);

  const askQueryActive = searchParams.get('ask') === '1';

  useEffect(() => {
    if (!askQueryActive) return;
    if (autoAskHandled) return;
    if (!offer) return;
    if (!me) return;
    if (!canOpenModal) return;
    setShowModal(true);
    setAutoAskHandled(true);
  }, [askQueryActive, autoAskHandled, offer, me, canOpenModal]);

  async function createRequest(note: string) {
    if (!offer || !me) return;

    const cleanedNote = note.trim() || '—';
    let requestId: string | null = null;

    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_request', {
      p_offer: offer.id,
      p_note: cleanedNote,
    });

    if (!rpcErr && rpcData) {
      requestId = typeof rpcData === 'string' ? rpcData : (rpcData as any);
    } else {
      const { data: ins, error: insErr } = await supabase
        .from('requests')
        .insert({
          offer_id: offer.id,
          requester_profile_id: me,
          note: cleanedNote,
        })
        .select('id')
        .single();
      if (insErr) throw insErr;
      requestId = ins!.id as string;
    }

    if (requestId) {
      const payload = { request_id: requestId, offer_id: offer.id, sender_id: me, text: cleanedNote };
      try {
        await supabase.from('notifications').insert([
          { profile_id: me, type: 'message', data: payload, read_at: new Date().toISOString() },
          { profile_id: offer.owner_id, type: 'message_received', data: payload },
        ]);
      } catch {}
    }

    const peer = offer.owner_id;
    router.push(peer ? `/messages?thread=${peer}` : '/messages');
  }

  function handleAskClick() {
    if (!offer) return;
    if (!me) {
      const next = `/offers/${offer.id}?ask=1`;
      router.push(`/sign-in?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!canOpenModal) return;
    setShowModal(true);
    if (askQueryActive && !autoAskHandled) {
      setAutoAskHandled(true);
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

  const signInNextHref = `/sign-in?next=${encodeURIComponent(`/offers/${offer.id}?ask=1`)}`;

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
                  Please <Link href={signInNextHref} className="hx-link">sign in</Link> to ask.
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
              onClick={handleAskClick}
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

      {/* GRATITUDE: moved BELOW the Ask-to-Receive/owner block */}
      <OfferGratitude offerId={offer.id} offerTitle={offer.title} limit={3} />

      {showModal && (
        <RequestModal
          title="Ask to Receive"
          placeholder="Share context and what you’re hoping for…"
          submitLabel="Ask to Receive"
          onCancel={() => setShowModal(false)}
          onSubmit={async (note, setBusy, setError) => {
            setBusy(true);
            setError('');
            try {
              await createRequest(note);
            } catch (e: any) {
              setError(e?.message ?? 'Could not send your ask.');
              setBusy(false);
              return;
            }
          }}
        />
      )}
    </section>
  );
}
