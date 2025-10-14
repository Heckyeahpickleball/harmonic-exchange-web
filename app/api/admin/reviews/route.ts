// app/api/admin/reviews/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Anonymous client (only to decode a Bearer JWT if present)
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Service client (server-only; bypasses RLS)
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// helpers
const firstText = (o: any) =>
  o?.quote ?? o?.message ?? o?.text ?? o?.content ?? o?.body ?? null;
const idOrNull = (v: any) => (typeof v === 'string' ? v : v ?? null);

/** Resolve the current user from Authorization header or Supabase auth cookie. */
async function getUserFromRequest(req: Request) {
  // A) Authorization: Bearer <token>
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (token) {
    const { data } = await anon.auth.getUser(token);
    if (data?.user) return data.user;
  }

  // B) Supabase auth cookie (Next 15 cookies() is async)
  const store = await cookies();
  const supaFromCookie = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      get: (name: string) => store.get(name)?.value,
      set: (_n: string, _v: string, _o: CookieOptions) => {},
      remove: (_n: string, _o: CookieOptions) => {},
    },
  });

  const { data } = await supaFromCookie.auth.getUser();
  return data?.user ?? null;
}

export async function GET(req: Request) {
  try {
    // 1) Identify user
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }

    // 2) Ensure user is admin/mod
    const { data: prof, error: profErr } = await service
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    if (!prof || (prof.role !== 'admin' && prof.role !== 'moderator')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 3) Prefer the view used by the public page; then try reviews; then gratitudes
    //    This maximizes compatibility with your current schema.
    let source: 'review_gratitudes' | 'reviews' | 'gratitudes' = 'review_gratitudes';
    let rows: any[] = [];

    // A) view: review_gratitudes (what the Reviews page uses)
    const view = await service
      .from('review_gratitudes')
      .select('id, request_id, offer_id, quote, owner_name, receiver_name, offer_title, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!view.error && view.data?.length) {
      rows = view.data;
      source = 'review_gratitudes';

      // Normalize to Admin UI shape
      const items = rows.map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        quote: firstText(r),
        rating: null, // view has no rating column
        author_id: null,
        subject_id: null,
        author_name: r.owner_name ?? null,   // shows who wrote it (sender/receiver wording differs per schema)
        subject_name: r.receiver_name ?? null,
        offer_id: idOrNull(r.offer_id),
        request_id: idOrNull(r.request_id),
      }));

      return NextResponse.json({ source, items });
    }

    // B) fallback: canonical reviews table
    const rv = await service
      .from('reviews')
      .select('id, quote, rating, author_id, subject_id, offer_id, request_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!rv.error && rv.data?.length) {
      rows = rv.data;
      source = 'reviews';

      const items = rows.map((r: any) => ({
        id: r.id,
        created_at: r.created_at,
        quote: firstText(r),
        rating: typeof r.rating === 'number' ? r.rating : null,
        author_id: idOrNull(r.author_id),
        subject_id: idOrNull(r.subject_id),
        offer_id: idOrNull(r.offer_id),
        request_id: idOrNull(r.request_id),
      }));

      return NextResponse.json({ source, items });
    }

    // C) fallback: raw gratitudes table (older installs)
    const gr = await service
      .from('gratitudes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (gr.error) {
      const msg = rv.error?.message || gr.error?.message || 'failed to load reviews';
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    rows = gr.data || [];
    source = 'gratitudes';

    const items = rows.map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      quote: firstText(r),
      rating: null,
      author_id: idOrNull(r.author_id ?? r.from_profile ?? r.from_profile_id),
      subject_id: idOrNull(r.subject_id ?? r.to_profile ?? r.to_profile_id),
      offer_id: idOrNull(r.offer_id),
      request_id: idOrNull(r.request_id),
    }));

    return NextResponse.json({ source, items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'server error' },
      { status: 500 },
    );
  }
}
