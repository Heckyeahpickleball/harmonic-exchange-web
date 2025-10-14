// app/api/admin/reviews/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Anonymous client (for decoding explicit Bearer JWTs)
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Service client (server-only; bypasses RLS)
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function firstText(o: any) {
  return o?.quote ?? o?.message ?? o?.text ?? o?.content ?? o?.body ?? null;
}
function idOrNull(v: any) {
  return typeof v === 'string' ? v : v ?? null;
}

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

  // B) Supabase auth cookie (works server-side with Next/SSR helper)
  const cookieStore = await cookies(); // now asynchronous
  const supaFromCookie = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (_name: string, _value: string, _options: CookieOptions) => {
        // no-op: API route doesn't need to mutate cookies
      },
      remove: (_name: string, _options: CookieOptions) => {
        // no-op
      },
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

    // 3) Load reviews or fall back to gratitudes
    let source: 'reviews' | 'gratitudes' = 'reviews';
    let rows: any[] = [];

    const rv = await service
      .from('reviews')
      .select('id, quote, rating, author_id, subject_id, offer_id, request_id, created_at')
      .order('created_at', { ascending: false })
      .limit(500);

    if (!rv.error && rv.data?.length) {
      rows = rv.data;
      source = 'reviews';
    } else {
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
    }

    // 4) Normalize payload for Admin UI
    const items = rows.map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      quote: firstText(r),
      rating: typeof r.rating === 'number' ? r.rating : null,
      author_id: idOrNull(r.author_id ?? r.from_profile ?? r.from_profile_id),
      subject_id: idOrNull(r.subject_id ?? r.to_profile ?? r.to_profile_id),
      offer_id: idOrNull(r.offer_id),
      request_id: idOrNull(r.request_id),
    }));

    return NextResponse.json({ source, items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'server error' },
      { status: 500 }
    );
  }
}
