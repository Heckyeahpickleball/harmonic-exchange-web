import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) {
  throw new Error('Supabase URL/ANON env vars are missing.');
}

export async function POST(req: Request) {
  try {
    if (!SERVICE) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY is not set; cannot delete admin reviews.' },
        { status: 500 }
      );
    }

    const { id, reason } = await req.json();

    // Identify caller and require admin
    const auth = req.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    const userClient = createClient(URL, ANON, {
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    });

    const { data: me } = await userClient
      .from('profiles')
      .select('id,role')
      .limit(1)
      .single();

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const svc = createClient(URL, SERVICE);

    // Try reviews first
    const r1 = await svc.from('reviews').delete().eq('id', id);
    if (r1.error && !/relation .* does not exist/i.test(r1.error.message)) {
      throw r1.error;
    }

    if (r1.error) {
      // Fallback to gratitudes
      const r2 = await svc.from('gratitudes').delete().eq('id', id);
      if (r2.error) throw r2.error;

      await svc.from('admin_actions').insert({
        admin_profile_id: me.id,
        action: 'gratitudes.delete',
        target_type: 'review',
        target_id: id,
        reason: reason ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    await svc.from('admin_actions').insert({
      admin_profile_id: me.id,
      action: 'reviews.delete',
      target_type: 'review',
      target_id: id,
      reason: reason ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error' }, { status: 500 });
  }
}
