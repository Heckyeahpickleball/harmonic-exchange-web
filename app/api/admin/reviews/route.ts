// app/api/admin/reviews/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// lightweight clients
const anon = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// helpers
function firstText(o: any) {
  return (
    o?.quote ??
    o?.message ??
    o?.text ??
    o?.content ??
    o?.body ??
    null
  );
}
function idOrNull(v: any) {
  return typeof v === 'string' ? v : v ?? null;
}
function numOrNull(v: any) {
  return typeof v === 'number' ? v : v == null ? null : Number(v) || null;
}

/** Resolve current user from Authorization header or Supabase auth cookie. */
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

  // B) Auth cookie via SSR client
  const cookieStore = await cookies();
  const supaFromCookie = createServerClient(SUPABASE_URL, ANON_KEY, {
    cookies: {
      get: (name: string) => cookieStore.get(name)?.value,
      set: (_name: string, _value: string, _options: CookieOptions) => {},
      remove: (_name: string, _options: CookieOptions) => {},
    },
  });

  const { data } = await supaFromCookie.auth.getUser();
  return data?.user ?? null;
}

/** Best-effort SELECT that ignores "relation does not exist" errors. */
async function safeSelect(
  tableOrView: string,
  columns: string
): Promise<{ rows: any[]; error?: string }> {
  try {
    const { data, error } = await service.from(tableOrView).select(columns).order('created_at', { ascending: false }).limit(500);
    if (error) return { rows: [], error: error.message };
    return { rows: data || [] };
  } catch (e: any) {
    // If the view/table doesn't exist, treat as empty
    const msg = String(e?.message || e);
    if (/relation .* does not exist/i.test(msg)) return { rows: [] };
    return { rows: [], error: msg };
  }
}

export async function GET(req: Request) {
  try {
    // 1) Auth user
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    // 2) Ensure admin or moderator
    const { data: prof, error: profErr } = await service
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });
    if (!prof || (prof.role !== 'admin' && prof.role !== 'moderator')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // 3) Try common review sources in priority order
    //    a) a unified view (often what the public page reads)
    //    b) gratitudes (thanks)
    //    c) reviews (explicit star reviews)
    type Source = 'review_gratitudes' | 'gratitudes' | 'reviews';
    let source: Source | null = null;
    let rows: any[] = [];

    // (a) unified view — adjust name if your project uses a different one
    const tryViews = ['review_gratitudes', 'public_reviews', 'reviews_unified'];
    for (const viewName of tryViews) {
      const { rows: vrows } = await safeSelect(viewName,
        // include common columns + extras if present
        '*, id, created_at, quote, message, text, content, body, rating, ' +
        'author_id, reviewer_id, from_profile, from_profile_id, sender_profile_id, ' +
        'subject_id, to_profile, to_profile_id, receiver_profile_id, offer_id, request_id'
      );
      if (vrows.length) {
        source = viewName as Source;
        rows = vrows;
        break;
      }
    }

    // (b) fallback: gratitudes
    if (!rows.length) {
      const { rows: grows } = await safeSelect('gratitudes',
        '*, id, created_at, quote, message, text, content, body, rating, ' +
        'from_profile, from_profile_id, sender_profile_id, ' +
        'to_profile, to_profile_id, receiver_profile_id, offer_id, request_id'
      );
      if (grows.length) {
        source = 'gratitudes';
        rows = grows;
      }
    }

    // (c) fallback: reviews
    if (!rows.length) {
      const { rows: rrows } = await safeSelect('reviews',
        '*, id, created_at, quote, message, text, content, body, rating, ' +
        'author_id, reviewer_id, subject_id, offer_id, request_id'
      );
      if (rrows.length) {
        source = 'reviews';
        rows = rrows;
      }
    }

    // 4) Normalize for Admin UI
    const items = rows.map((r: any) => ({
      id: r.id,
      created_at: r.created_at,
      quote: firstText(r),
      rating: numOrNull(r.rating),
      author_id: idOrNull(
        r.author_id ??
        r.reviewer_id ??
        r.from_profile ??
        r.from_profile_id ??
        r.sender_profile_id
      ),
      subject_id: idOrNull(
        r.subject_id ??
        r.to_profile ??
        r.to_profile_id ??
        r.receiver_profile_id
      ),
      offer_id: idOrNull(r.offer_id),
      request_id: idOrNull(r.request_id),
    }));

    return NextResponse.json({ source: source ?? 'gratitudes', items });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'server error' },
      { status: 500 }
    );
  }
}
