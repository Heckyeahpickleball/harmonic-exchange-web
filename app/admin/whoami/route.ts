// /app/admin/whoami/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  try {
    const authz = req.headers.get('authorization') || '';
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'missing bearer token' }, { status: 401 });
    }

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: u, error: uerr } = await userClient.auth.getUser();
    if (uerr || !u?.user) {
      return NextResponse.json({ error: 'invalid token' }, { status: 401 });
    }
    const uid = u.user.id;
    const email = u.user.email ?? null;

    const { data: me, error: perr } = await userClient
      .from('profiles')
      .select('id, role, status')
      .eq('id', uid)
      .single();

    return NextResponse.json({ uid, email, me, perr: perr?.message ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'unexpected' }, { status: 500 });
  }
}
