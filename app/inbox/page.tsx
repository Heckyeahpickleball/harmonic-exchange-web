'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'

type Req = {
  id: string
  offer_id: string
  requester_profile_id: string
  note: string
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'fulfilled'
  created_at: string
}

type OfferLite = { id: string; title: string; owner_id: string }
type ProfileLite = { id: string; display_name: string }

export default function InboxPage() {
  const [tab, setTab] = useState<'received' | 'sent'>('received')
  const [received, setReceived] = useState<Req[]>([])
  const [sent, setSent] = useState<Req[]>([])
  const [offers, setOffers] = useState<Record<string, OfferLite>>({})
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({})
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const visible = useMemo(() => (tab === 'received' ? received : sent), [tab, received, sent])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const uid = sess.session?.user?.id
        if (!uid) { setLoading(false); return }

        // Offers I own (for "received")
        const { data: myOffers, error: offErr } = await supabase
          .from('offers')
          .select('id, title, owner_id')
          .eq('owner_id', uid)
        if (offErr) throw offErr

        const ownedIds = (myOffers ?? []).map(o => o.id)
        const offerMap: Record<string, OfferLite> = {}
        for (const o of (myOffers ?? []) as OfferLite[]) offerMap[o.id] = o

        // Requests received (for my offers)
        const { data: rec, error: recErr } = await supabase
          .from('requests')
          .select('id, offer_id, requester_profile_id, note, status, created_at')
          .in('offer_id', ownedIds.length ? ownedIds : ['00000000-0000-0000-0000-000000000000']) // safe empty
          .order('created_at', { ascending: false })
        if (recErr) throw recErr

        // Requests I sent
        const { data: sentRows, error: sErr } = await supabase
          .from('requests')
          .select('id, offer_id, requester_profile_id, note, status, created_at')
          .eq('requester_profile_id', uid)
          .order('created_at', { ascending: false })
        if (sErr) throw sErr

        // Fetch related offers for "sent"
        const sentOfferIds = Array.from(new Set((sentRows ?? []).map(r => r.offer_id)))
        if (sentOfferIds.length) {
          const { data: sentOffers } = await supabase
            .from('offers')
            .select('id, title, owner_id')
            .in('id', sentOfferIds)
          for (const o of (sentOffers ?? []) as OfferLite[]) offerMap[o.id] = o
        }

        // Fetch requester profile names for "received"
        const requesterIds = Array.from(new Set((rec ?? []).map(r => r.requester_profile_id)))
        const profMap: Record<string, ProfileLite> = {}
        if (requesterIds.length) {
          const { data: reqProfiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', requesterIds)
          for (const p of (reqProfiles ?? []) as ProfileLite[]) profMap[p.id] = p
        }

        // Fetch owners for "sent"
        const ownerIds = Array.from(new Set(sentOfferIds.map(id => offerMap[id]?.owner_id).filter(Boolean) as string[]))
        if (ownerIds.length) {
          const { data: ownProfiles } = await supabase
            .from('profiles')
            .select('id, display_name')
            .in('id', ownerIds)
          for (const p of (ownProfiles ?? []) as ProfileLite[]) profMap[p.id] = p
        }

        if (!mounted) return
        setOffers(offerMap)
        setProfiles(profMap)
        setReceived((rec ?? []) as Req[])
        setSent((sentRows ?? []) as Req[])
      } catch (e: any) {
        console.error(e)
        setMsg(e?.message ?? 'Failed to load inbox.')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  async function respond(reqId: string, next: Req['status']) {
    setMsg('')
    // optimistic UI
    setReceived(prev => prev.map(r => (r.id === reqId ? { ...r, status: next } : r)))
    const { error } = await supabase.from('requests').update({ status: next }).eq('id', reqId)
    if (error) setMsg(error.message)
  }

  return (
    <section className="max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">Inbox</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('received')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'received' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Received
          </button>
          <button
            onClick={() => setTab('sent')}
            className={`rounded border px-3 py-1 text-sm ${tab === 'sent' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
          >
            Sent
          </button>
        </div>
      </div>

      {msg && <p className="mt-2 text-sm text-amber-700">{msg}</p>}
      {loading && <p className="mt-2 text-sm text-gray-600">Loading…</p>}

      <div className="mt-4 space-y-3">
        {visible.map(r => {
          const off = offers[r.offer_id]
          const requester = profiles[r.requester_profile_id]
          const owner = off ? profiles[off.owner_id] : undefined
          const title = off?.title ?? 'Offer'
          const ts = new Date(r.created_at).toLocaleString()

          return (
            <div key={r.id} className="rounded border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    {tab === 'received' ? (
                      <>
                        <span>{requester?.display_name ?? 'Someone'}</span> requested:&nbsp;
                        <Link href={`/offers/${r.offer_id}`} className="underline">{title}</Link>
                      </>
                    ) : (
                      <>
                        You requested:&nbsp;
                        <Link href={`/offers/${r.offer_id}`} className="underline">{title}</Link>
                        {owner && <> (to {owner.display_name})</>}
                      </>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{r.note}</div>
                  <div className="mt-1 text-[11px] text-gray-500">{ts}</div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-xs rounded px-2 py-0.5 border ${r.status === 'pending' ? 'bg-amber-50' : ''}`}>
                    {r.status}
                  </span>
                  {tab === 'received' && r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => respond(r.id, 'accepted')}
                        className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respond(r.id, 'declined')}
                        className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && visible.length === 0 && (
        <p className="mt-4 text-sm text-gray-600">
          {tab === 'received' ? 'No incoming requests yet.' : 'You haven’t sent any requests yet.'}
        </p>
      )}
    </section>
  )
}
