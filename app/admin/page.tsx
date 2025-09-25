/* HX v0.5 — 2025-09-21 — Admin panel with write-through audit log
   File: app/admin/page.tsx
*/
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Profile = {
  id: string;
  display_name: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended';
  created_at: string;
};

type OfferRow = {
  id: string;
  title: string;
  owner_id: string;
  status: 'active' | 'paused' | 'archived' | 'blocked';
  created_at: string;
};

type AdminAction = {
  id: string;
  admin_profile_id: string;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
  admin_name?: string;
  target_label?: string;
};

type Tab = 'users' | 'offers' | 'audit';

export default function AdminPage() {
  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [audit, setAudit] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Load current user + gate
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setMe(null);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name,role,status,created_at')
        .eq('id', uid)
        .single();
      setMe((data || null) as Profile | null);
    })();
  }, []);

  const isAdmin = me?.role === 'admin' || me?.role === 'moderator';

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      setMsg('');
      try {
        if (tab === 'users') {
          const { data } = await supabase
            .from('profiles')
            .select('id,display_name,role,status,created_at')
            .order('created_at', { ascending: false })
            .limit(200);
          setUsers((data || []) as Profile[]);
        } else if (tab === 'offers') {
          const { data } = await supabase
            .from('offers')
            .select('id,title,owner_id,status,created_at')
            .order('created_at', { ascending: false })
            .limit(200);
          setOffers((data || []) as OfferRow[]);
        } else if (tab === 'audit') {
          // Pull recent 200 actions
          const { data: rows } = await supabase
            .from('admin_actions')
            .select('id,admin_profile_id,action,target_type,target_id,reason,created_at')
            .order('created_at', { ascending: false })
            .limit(200);

          const acts = (rows || []) as AdminAction[];

          // Resolve admin names
          const adminIds = Array.from(new Set(acts.map((a) => a.admin_profile_id)));
          const adminMap = new Map<string, string>();
          if (adminIds.length) {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id,display_name')
              .in('id', adminIds);
            for (const a of ((admins || []) as Profile[])) adminMap.set(a.id, a.display_name);
          }

          // Resolve target labels (profiles/offers)
          const profileTargets = acts.filter((a) => a.target_type === 'profile').map((a) => a.target_id);
          const offerTargets = acts.filter((a) => a.target_type === 'offer').map((a) => a.target_id);

          const [profileRows, offerRows] = await Promise.all([
            profileTargets.length
              ? supabase.from('profiles').select('id,display_name').in('id', profileTargets)
              : Promise.resolve({ data: [] as any[] }),
            offerTargets.length
              ? supabase.from('offers').select('id,title').in('id', offerTargets)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          const profMap = new Map<string, string>();
          for (const p of ((profileRows as any).data || []) as any[]) profMap.set(p.id, p.display_name);
          const offerMap = new Map<string, string>();
          for (const o of ((offerRows as any).data || []) as any[]) offerMap.set(o.id, o.title);

          setAudit(
            acts.map((a) => ({
              ...a,
              admin_name: adminMap.get(a.admin_profile_id) || a.admin_profile_id,
              target_label:
                a.target_type === 'profile'
                  ? profMap.get(a.target_id) || a.target_id
                  : offerMap.get(a.target_id) || a.target_id,
            }))
          );
        }
      } catch (e: any) {
        console.error(e);
        setMsg(e?.message ?? 'Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin, tab]);

  const usersVisible = useMemo(() => users, [users]);
  const offersVisible = useMemo(() => offers, [offers]);

  // ===== Actions =====
  async function setUserStatus(id: string, next: 'active' | 'suspended') {
    setMsg('');
    const reason = prompt(`Reason for setting status to ${next}? (optional)`) || null;
    try {
      await supabase.rpc('admin_user_set_status', { p_profile_id: id, p_status: next, p_reason: reason });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: next } : u)));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to set status');
    }
  }

  async function setUserRole(id: string, next: 'user' | 'moderator' | 'admin') {
    setMsg('');
    const reason = prompt(`Reason for changing role to ${next}? (optional)`) || null;
    try {
      await supabase.rpc('admin_user_set_role', { p_profile_id: id, p_role: next, p_reason: reason });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to change role');
    }
  }

  async function setOfferStatus(id: string, next: OfferRow['status']) {
    setMsg('');
    const reason = prompt(`Reason for setting offer status to ${next}? (optional)`) || null;
    try {
      await supabase.rpc('admin_offer_set_status', { p_offer_id: id, p_status: next, p_reason: reason });
      setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to set offer status');
    }
  }

  if (!me) {
    return (
      <section className="max-w-5xl">
        <p>Loading…</p>
      </section>
    );
  }
  if (!isAdmin) {
    return (
      <section className="max-w-5xl">
        <h2 className="text-2xl font-bold">Admin</h2>
        <p>You don’t have access.</p>
      </section>
    );
  }

  return (
    <section className="max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Admin</h2>
        <div className="flex gap-2">
          {(['users', 'offers', 'audit'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded border px-3 py-1 text-sm ${tab === t ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {tab === 'users' && (
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Joined</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersVisible.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2">{u.display_name}</td>
                  <td className="px-3 py-2">{u.role}</td>
                  <td className="px-3 py-2">{u.status}</td>
                  <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {u.status === 'active' ? (
                        <button
                          onClick={() => setUserStatus(u.id, 'suspended')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => setUserStatus(u.id, 'active')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Unsuspend
                        </button>
                      )}
                      {u.role !== 'user' && (
                        <button
                          onClick={() => setUserRole(u.id, 'user')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Demote to user
                        </button>
                      )}
                      {u.role !== 'moderator' && (
                        <button
                          onClick={() => setUserRole(u.id, 'moderator')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Promote to mod
                        </button>
                      )}
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => setUserRole(u.id, 'admin')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Promote to admin
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {usersVisible.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={5}>
                    No users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'offers' && (
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Owner</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {offersVisible.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-3 py-2">{o.title}</td>
                  <td className="px-3 py-2">{o.owner_id}</td>
                  <td className="px-3 py-2">{o.status}</td>
                  <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {o.status !== 'blocked' ? (
                        <button
                          onClick={() => setOfferStatus(o.id, 'blocked')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Block
                        </button>
                      ) : (
                        <button
                          onClick={() => setOfferStatus(o.id, 'active')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Unblock
                        </button>
                      )}
                      {o.status !== 'paused' && (
                        <button
                          onClick={() => setOfferStatus(o.id, 'paused')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Pause
                        </button>
                      )}
                      {o.status !== 'archived' && (
                        <button
                          onClick={() => setOfferStatus(o.id, 'archived')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Archive
                        </button>
                      )}
                      {o.status !== 'active' && (
                        <button
                          onClick={() => setOfferStatus(o.id, 'active')}
                          className="rounded border px-2 py-1 hover:bg-gray-50"
                        >
                          Set Active
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {offersVisible.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={5}>
                    No offers.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <ul className="space-y-3">
          {audit.map((a) => (
            <li key={a.id} className="rounded border p-3 text-sm">
              <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
              <div className="mt-1">
                <span className="font-medium">{a.admin_name || a.admin_profile_id}</span>{' '}
                performed <span className="font-mono">{a.action}</span> on <span className="font-mono">{a.target_type}</span>{' '}
                “{a.target_label || a.target_id}”
                {a.reason ? (
                  <>
                    {' '}
                    — <span className="italic text-gray-700">“{a.reason}”</span>
                  </>
                ) : null}
              </div>
            </li>
          ))}
          {audit.length === 0 && <p className="text-sm text-gray-600">No admin actions yet.</p>}
        </ul>
      )}
    </section>
  );
}
