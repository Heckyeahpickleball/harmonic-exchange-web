// app/api/admin/reviews/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SRV  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// anon client just to validate the caller's JWT
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
// service client (bypasses RLS); must be the service key from the SAME project
const svc  = createClient(URL, SRV,  { auth: { persistSession: false } });

function textish(o: any) {
  return o?.quote ?? o?.message ?? o?.text ?? o?.content ?? o?.body ?? null;
}
const sid = (v: any) => (typeof v === 'string' ? v : v ?? null);

export async function GET(req: Request) {
  try {
    // ---- 1) Auth the caller (must be admin/mod) ----
    const auth = req.headers.get('authorization') || '';
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
    if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    const { data: u } = await anon.auth.getUser(token);
    const user = u?.user;
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

    const { data: me, error: meErr } = await svc
      .from('profiles')
      .select('id,role')
      .eq('id', user.id)
      .single();

    if (meErr || !me || !['admin', 'moderator'].includes(me.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // ---- 2) Pull reviews with robust fallbacks + quick diagnostics ----
    // try canonical reviews
    const rv = await svc.from('reviews').select('*').order('created_at', { ascending: false }).limit(500);
    let source: 'reviews' | 'gratitudes' = 'reviews';
    let rows: any[] = [];

    if (!rv.error && rv.data && rv.data.length) {
      rows = rv.data;
      source = 'reviews';
    } else {
      // fall back to gratitudes (handle multiple column names)
      const gr = await svc.from('gratitudes').select('*').order('created_at', { ascending: false }).limit(500);
      rows = gr.data || [];
      source = 'gratitudes';
    }

    // normalize
    const items = rows.map((r: any) => ({
      id: r.id,
      created_at: r.created_at ?? r.inserted_at ?? r.createdAt ?? null,
      quote: textish(r),
      rating: typeof r.rating === 'number' ? r.rating : null,
      author_id: sid(r.author_id ?? r.from_profile ?? r.from_profile_id),
      subject_id: sid(r.subject_id ?? r.to_profile   ?? r.to_profile_id),
      offer_id: sid(r.offer_id),
      request_id: sid(r.request_id),
    }));

    // DIAGNOSTIC payload helps catch project/ENV mismatches
    const diag = {
      url: URL,
      anonKeyPrefix: ANON?.slice(0, 8),
      serviceKeyPrefix: SRV?.slice(0, 8),
      tableTried: source,
      counts: {
        reviewsTried: !rv.error ? (rv.data?.length ?? 0) : -1,
        gratitudesTried: source === 'gratitudes' ? items.length : undefined,
      },
    };

    return NextResponse.json({ source, items, _diag: diag });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'server error' }, { status: 500 });
  }
}
