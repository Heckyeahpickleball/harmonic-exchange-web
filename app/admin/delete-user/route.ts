// app/admin/delete-user/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Require these env vars:
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const { profile_id, reason } = await req.json().catch(() => ({}));
    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    }

    // 1) Get bearer token from client
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2) Verify the token -> who is calling?
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    const { data: userRes, error: authErr } = await supabaseAuth.auth.getUser(token);
    if (authErr || !userRes?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const myId = userRes.user.id;

    // 3) Check the caller’s role in profiles
    const { data: meRow, error: meErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', myId)
      .maybeSingle();

    if (meErr) {
      return NextResponse.json({ error: meErr.message }, { status: 500 });
    }
    if (!meRow || meRow.role !== 'admin') {
      return NextResponse.json({ error: 'not_admin' }, { status: 403 });
    }
    if (myId === profile_id) {
      return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });
    }

    // 4) Delete user (Auth) with service-role
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(profile_id);
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 400 });
    }

    // 5) Best-effort audit log (non-blocking)
    try {
      await supabaseAdmin.from('admin_actions').insert({
        admin_profile_id: myId,
        action: 'users.delete',
        target_type: 'profile',
        target_id: profile_id,
        reason: reason ?? null,
      });
    } catch {
      /* ignore */
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
