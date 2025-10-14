import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, reason } = body || {};

    // AuthN caller and require admin
    const auth = req.headers.get('authorization') || '';
    const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null;

    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} } }
    );

    const { data: me } = await userClient
      .from('profiles')
      .select('id,role')
      .limit(1)
      .single();

    if (!me || me.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Try reviews first
    const r1 = await supabase.from('reviews').delete().eq('id', id);
    if (r1.error && !/relation .* does not exist/i.test(r1.error.message)) {
      // If the table exists but deletion failed for another reason, bubble it
      throw r1.error;
    }

    if (r1.error) {
      // Fallback to gratitudes
      const r2 = await supabase.from('gratitudes').delete().eq('id', id);
      if (r2.error) throw r2.error;

      // Audit
      await supabase.from('admin_actions').insert({
        admin_profile_id: me.id,
        action: 'gratitudes.delete',
        target_type: 'review',
        target_id: id,
        reason: reason ?? null,
      });

      return NextResponse.json({ ok: true });
    }

    // Audit
    await supabase.from('admin_actions').insert({
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
