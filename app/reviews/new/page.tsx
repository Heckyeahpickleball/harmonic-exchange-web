// /app/reviews/new/page.tsx
'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type ReqRow = {
  id: string;
  offer_id: string;
  requester_profile_id: string;
  status: string;
};

type OfferRow = {
  id: string;
  title: string;
  owner_id: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
};

export default function Page() {
  return (
    <Suspense fallback={<section className="max-w-3xl p-4 text-sm text-gray-600">Loading…</section>}>
      <NewGratitude />
    </Suspense>
  );
}

function NewGratitude() {
  const sp = useSearchParams();
  const router = useRouter();

  // Accept BOTH ?request_id= and ?request=
  const requestId = (sp.get('request_id') || sp.get('request') || '').trim();

  const [viewer, setViewer] = useState<string | null>(null);
  const [req, setReq] = useState<ReqRow | null>(null);
  const [offer, setOffer] = useState<OfferRow | null>(null);
  const [owner, setOwner] = useState<ProfileRow | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [value, setValue] = useState('');

  const minLen = 10;
  const maxLen = 4000;

  const canSubmit = useMemo(() => {
    if (!viewer || !req || !offer) return false;
    if (!['fulfilled', 'completed', 'done'].includes((req.status || '').toLowerCase())) return false;
    if (viewer !== req.requester_profile_id) return false; // only the receiver writes gratitude
    const len = value.trim().length;
    return len >= minLen && len <= maxLen;
  }, [viewer, req, offer, value]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!cancel) setViewer(auth?.user?.id ?? null);
    })();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!requestId) {
      setMsg('Missing request id.');
      return;
    }
    let cancel = false;
    (async () => {
      setMsg('');
      // 1) Load request
      const { data: r, error: rErr } = await supabase
        .from('requests')
        .select('id,offer_id,requester_profile_id,status')
        .eq('id', requestId)
        .single();
      if (rErr || !r) {
        if (!cancel) setMsg('This exchange could not be found.');
        return;
      }
      if (!cancel) setReq(r as ReqRow);

      // 2) Load offer
      const { data: o } = await supabase
        .from('offers')
        .select('id,title,owner_id')
        .eq('id', r.offer_id)
        .single();
      if (!cancel) setOffer((o || null) as any);

      // 3) Load owner display name (optional)
      if (o?.owner_id) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id,display_name')
          .eq('id', o.owner_id)
          .single();
        if (!cancel) setOwner((p || null) as any);
      }
    })();
    return () => { cancel = true; };
  }, [requestId]);

  async function submit() {
    if (!canSubmit || !req) return;
    setBusy(true);
    setMsg('');
    try {
      const { error } = await supabase.from('gratitude_reviews').insert({
        request_id: req.id,
        message: value.trim(),
        published: true,
      });
      if (error) throw error;
      router.replace('/reviews?created=1');
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not save your gratitude.');
      setBusy(false);
    }
  }

  const blocked =
    viewer && req ? (viewer !== req.requester_profile_id ? 'Only the receiver can write this gratitude.' : null) : null;
  const notFulfilled =
    req && !['fulfilled', 'completed', 'done'].includes((req.status || '').toLowerCase())
      ? 'This exchange is not marked fulfilled yet.'
      : null;

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      <Link href="/reviews" className="text-sm underline">← Back to Past Exchanges</Link>

      <h1 className="text-xl font-bold">Share Gratitude</h1>

      {offer && (
        <div className="rounded border p-3 text-sm bg-white">
          <div><b>Offer:</b> {offer.title}</div>
          {owner && <div className="mt-0.5 text-gray-600"><b>From:</b> {owner.display_name}</div>}
        </div>
      )}

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {blocked && <p className="text-sm text-red-700">{blocked}</p>}
      {notFulfilled && <p className="text-sm text-red-700">{notFulfilled}</p>}

      <div className="rounded border p-3 bg-white">
        <label className="block text-sm font-medium">Your gratitude message</label>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          maxLength={maxLen}
          className="mt-1 w-full rounded border p-2 text-sm"
          placeholder="Share appreciation and the outcome of this exchange…"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
          <span>{Math.max(0, value.trim().length)} / {maxLen}</span>
          <span>Minimum {minLen} characters</span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="hx-btn hx-btn--primary disabled:opacity-50"
            onClick={submit}
            disabled={!canSubmit || busy}
          >
            {busy ? 'Saving…' : 'Publish Gratitude'}
          </button>
          <Link href="/reviews" className="hx-btn hx-btn--secondary">Cancel</Link>
        </div>
      </div>
    </section>
  );
}
