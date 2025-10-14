import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY_PRESENT = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

type UiRole = 'user' | 'moderator' | 'admin';
const UI_TO_DB_ROLE: Record<UiRole, string> = { user: 'user', moderator: 'moderator', admin: 'admin' };

function combine(...parts: Array<any>): string | null {
  const list = parts
    .flatMap((p) => (Array.isArray(p) ? p : [p]))
    .filter(Boolean)
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean);
  return list.length ? Array.from(new Set(list)).join(' — ') : null;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: '/admin/set-role',
    methods: ['GET', 'POST'],
    serviceKeyPresent: SERVICE_KEY_PRESENT,
    runtime: 'nodejs',
  });
}

export async function POST(req: Request) {
  try {
    if (!SERVICE_KEY_PRESENT) {
      return NextResponse.json(
        { error: 'Service key missing', message: 'SUPABASE_SERVICE_ROLE_KEY not set', env_ok: false },
        { status: 500 },
      );
    }

    // Bearer token from the signed-in admin
    const authz = req.headers.get('authorization') || '';
    const token = authz.toLowerCase().startsWith('bearer ') ? authz.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });

    const { data: auth, error: authErr } = await userClient.auth.getUser();
    if (authErr || !auth?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const myId = auth.user.id;

    const admin = supabaseAdmin();

    // Verify caller is admin (server-side read, bypasses RLS safely)
    const { data: meRow, error: meErr } = await admin
      .from('profiles')
      .select('role')
      .eq('id', myId)
      .maybeSingle();
    if (meErr) return NextResponse.json({ error: 'Admin profile read failed', details: meErr.message }, { status: 500 });
    if (!meRow || meRow.role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can change user roles' }, { status: 403 });
    }

    // Body
    let body: { profile_id?: string; role?: UiRole; reason?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { profile_id, role, reason } = body;
    if (!profile_id || !role || !(role in UI_TO_DB_ROLE)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (profile_id === myId) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }

    // Ensure target exists
    const { data: target, error: tErr } = await admin
      .from('profiles')
      .select('id')
      .eq('id', profile_id)
      .maybeSingle();
    if (tErr) return NextResponse.json({ error: 'Target profile lookup failed', message: tErr.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: 'Target profile not found', profile_id }, { status: 404 });

    const dbRole = UI_TO_DB_ROLE[role];

    // Call RPC WITH THE USER TOKEN so auth.uid() inside SQL is your admin id
    let rpcErr: any = null;
    try {
      const { error } = await userClient.rpc('admin_set_role', {
        p_profile: profile_id,
        p_role: dbRole,
        p_reason: reason ?? null,
      });
      if (error) rpcErr = error;
    } catch (e: any) {
      rpcErr = e;
    }

    if (!rpcErr) {
      // Best-effort audit (RPC may already log)
      try {
        await admin.from('admin_actions').insert({
          admin_profile_id: myId,
          action: `profiles.role -> ${dbRole}`,
          target_type: 'profile',
          target_id: profile_id,
          reason: reason ?? null,
        });
      } catch {}
      return NextResponse.json({ ok: true, db_role: dbRole, via: 'rpc' });
    }

    // Service-role fallback (may be blocked by your trigger in DB)
    const { error: upErr } = await admin
      .from('profiles')
      .update({ role: dbRole } as any)
      .eq('id', profile_id);

    if (upErr) {
      const msg = combine(
        rpcErr?.message, rpcErr?.details, rpcErr?.hint, rpcErr?.code && `rpc:${rpcErr.code}`,
        (upErr as any)?.message, (upErr as any)?.details, (upErr as any)?.hint, (upErr as any)?.code && `direct:${(upErr as any).code}`,
      );
      return NextResponse.json(
        {
          error: 'Role change failed',
          message: msg,
          rpc: { message: rpcErr?.message ?? null, details: rpcErr?.details ?? null, hint: rpcErr?.hint ?? null, code: rpcErr?.code ?? null },
          direct: { message: (upErr as any)?.message ?? null, details: (upErr as any)?.details ?? null, hint: (upErr as any)?.hint ?? null, code: (upErr as any).code ?? null },
        },
        { status: 400 },
      );
    }

    try {
      await admin.from('admin_actions').insert({
        admin_profile_id: myId,
        action: `profiles.role -> ${dbRole}`,
        target_type: 'profile',
        target_id: profile_id,
        reason: reason ?? null,
      });
    } catch {}

    return NextResponse.json({ ok: true, db_role: dbRole, via: 'direct' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unexpected error' }, { status: 500 });
  }
}
