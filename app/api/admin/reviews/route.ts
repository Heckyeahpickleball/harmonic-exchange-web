import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // still works without SR key
  { auth: { persistSession: false } }
)

type Item = {
  id: string
  created_at: string
  quote: string | null
  rating: number | null
  author_id: string | null
  subject_id: string | null
  offer_id: string | null
  request_id: string | null
  author_name?: string | null
  subject_name?: string | null
  offer_title?: string | null
}

async function tryQuery(view: string, select: string) {
  const { data, error } = await supabaseAdmin.from(view as any).select(select).order('created_at', { ascending: false }).limit(500)
  if (error) return { ok: false as const, error }
  if (!data || data.length === 0) return { ok: false as const }
  return { ok: true as const, data }
}

export async function GET() {
  try {
    // 1) Your MV with names & avatars
    {
      const q = await tryQuery(
        'public_reviews_public_mv',
        'id, created_at, message, offer_title, owner_name, receiver_name'
      )
      if (q.ok) {
        const items: Item[] = q.data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: null,
          author_id: null,
          subject_id: null,
          offer_id: null,
          request_id: null,
          author_name: r.owner_name ?? null,
          subject_name: r.receiver_name ?? null,
          offer_title: r.offer_title ?? null,
        }))
        return NextResponse.json({ source: 'public_reviews_public_mv', items })
      }
    }

    // 2) Non-MV variant
    {
      const q = await tryQuery(
        'public_reviews_public',
        'id, created_at, message, offer_title, owner_name, receiver_name'
      )
      if (q.ok) {
        const items: Item[] = q.data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: null,
          author_id: null,
          subject_id: null,
          offer_id: null,
          request_id: null,
          author_name: r.owner_name ?? null,
          subject_name: r.receiver_name ?? null,
          offer_title: r.offer_title ?? null,
        }))
        return NextResponse.json({ source: 'public_reviews_public', items })
      }
    }

    // 3) Older consolidated view (ids present but naming differs)
    {
      const q = await tryQuery(
        'public_gratitude_reviews',
        'id, created_at, message, owner_profile_id, receiver_profile_id, offer_id, request_id'
      )
      if (q.ok) {
        const items: Item[] = q.data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: null,
          author_id: r.owner_profile_id ?? null,
          subject_id: r.receiver_profile_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
        }))
        return NextResponse.json({ source: 'public_gratitude_reviews', items })
      }
    }

    // 4) Historical view name
    {
      const q = await tryQuery(
        'review_gratitudes',
        'id, created_at, message, author_id, subject_id, offer_id, request_id, rating'
      )
      if (q.ok) {
        const items: Item[] = q.data.map((r: any) => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: r.rating ?? null,
          author_id: r.author_id ?? null,
          subject_id: r.subject_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
        }))
        return NextResponse.json({ source: 'review_gratitudes', items })
      }
    }

    // 5) Raw reviews table (if it exists)
    {
      const q = await tryQuery(
        'reviews',
        'id, created_at, quote, rating, author_id, subject_id, offer_id, request_id'
      )
      if (q.ok) {
        const items: Item[] = q.data as any[]
        return NextResponse.json({ source: 'reviews', items })
      }
    }

    // 6) Last resort: gratitudes table
    {
      const q = await tryQuery(
        'gratitudes',
        'id, created_at, message, owner_profile_id, receiver_profile_id, offer_id'
      )
      if (!q.ok) throw q.error || new Error('No review sources found')
      const items: Item[] = q.data.map((g: any) => ({
        id: g.id,
        created_at: g.created_at,
        quote: g.message ?? null,
        rating: null,
        author_id: g.owner_profile_id ?? null,
        subject_id: g.receiver_profile_id ?? null,
        offer_id: g.offer_id ?? null,
        request_id: null,
      }))
      return NextResponse.json({ source: 'gratitudes', items })
    }
  } catch (e: any) {
    console.error('/api/admin/reviews error:', e?.message || e)
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}
