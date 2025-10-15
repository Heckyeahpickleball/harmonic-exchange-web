import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Use service role so we can read admin views regardless of RLS */
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // required
  { auth: { persistSession: false } }
)

type Row = {
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
}

export async function GET() {
  try {
    // 1) Preferred consolidated view if present
    let source: 'public_gratitude_reviews' | 'review_gratitudes' | 'reviews' | 'gratitudes' = 'public_gratitude_reviews'
    let rows: any[] = []

    // Try public_gratitude_reviews first
    {
      const { data, error } = await supabaseAdmin
        .from('public_gratitude_reviews')
        .select('id, created_at, message:quote, rating, author_id, subject_id, offer_id, request_id, author_name, subject_name')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && data?.length) {
        rows = data.map(r => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: r.rating ?? null,
          author_id: r.author_id ?? null,
          subject_id: r.subject_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
          author_name: r.author_name ?? null,
          subject_name: r.subject_name ?? null,
        }))
        return NextResponse.json({ source, items: rows })
      }
    }

    // 2) Fallback: review_gratitudes view if that’s the name in your project
    {
      source = 'review_gratitudes'
      const { data, error } = await supabaseAdmin
        .from('review_gratitudes')
        .select('id, created_at, message:quote, rating, author_id, subject_id, offer_id, request_id')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && (data?.length ?? 0) > 0) {
        rows = data.map(r => ({
          id: r.id,
          created_at: r.created_at,
          quote: r.message ?? null,
          rating: r.rating ?? null,
          author_id: r.author_id ?? null,
          subject_id: r.subject_id ?? null,
          offer_id: r.offer_id ?? null,
          request_id: r.request_id ?? null,
        }))
        return NextResponse.json({ source, items: rows })
      }
    }

    // 3) Fallback: reviews table (if it exists)
    {
      source = 'reviews'
      const { data, error } = await supabaseAdmin
        .from('reviews')
        .select('id, created_at, quote, rating, author_id, subject_id, offer_id, request_id')
        .order('created_at', { ascending: false })
        .limit(500)

      if (!error && (data?.length ?? 0) > 0) {
        rows = data as Row[]
        return NextResponse.json({ source, items: rows })
      }
    }

    // 4) Last resort: map from gratitudes to the ReviewRow shape
    {
      source = 'gratitudes'
      const { data, error } = await supabaseAdmin
        .from('gratitudes')
        .select('id, created_at, message, owner_profile_id, receiver_profile_id, offer_id')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) throw error

      rows = (data || []).map((g: any) => ({
        id: g.id,
        created_at: g.created_at,
        quote: g.message ?? null,
        rating: null,
        author_id: g.owner_profile_id ?? null,
        subject_id: g.receiver_profile_id ?? null,
        offer_id: g.offer_id ?? null,
        request_id: null,
      }))
      return NextResponse.json({ source, items: rows })
    }
  } catch (err: any) {
    console.error('/api/admin/reviews error:', err?.message || err)
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 })
  }
}
