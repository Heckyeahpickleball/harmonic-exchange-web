/* HX v0.9 — Admin panel with emails + delete + owner labels + offer title search
   File: app/admin/page.tsx
*/
'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'user' | 'moderator' | 'admin';
type Status = 'active' | 'suspended';

type Profile = {
  id: string;
  display_name: string;
  role: Role;
  status: Status;
  created_at: string;
};

type OfferRow = {
  id: string;
  title: string;
  owner_id: string;
  status: 'pending' | 'active' | 'paused' | 'archived' | 'blocked';
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

type EmailRow = { id: string; email: string | null; display_name?: string };

type Tab = 'users' | 'offers' | 'audit';

/** Wrapper for Suspense requirement around useSearchParams */
export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const sp = useSearchParams();
  const urlTab = (sp.get('tab') as Tab | null) || null;
  const urlPendingOnly = sp.get('pending') === '1';
  const urlFocusOffer = sp.get('offer');

  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>(urlTab ?? 'users');
  const [pendingOnly, setPendingOnly] = useState<boolean>(urlPendingOnly);

  // quick title search (offers tab)
  const [offerQ, setOfferQ] = useState('');

  const [users, setUsers] = useState<Profile[]>([]);
  const [userEmails, setUserEmails] = useState<Record<string, string | null>>({});
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [ownerInfo, setOwnerInfo] = useState<Record<string, { name: string; email: string | null }>>({});
  const [audit, setAudit] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const offerRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (urlTab && urlTab !== tab) setTab(urlTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  // Load current user
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

  const canViewAdmin = me?.role === 'admin' || me?.role === 'moderator';
  const isAdmin = me?.role === 'admin';

  // ——— helpers for permissions (client guard) ———
  const canChangeStatus = (actor: Profile | null, target: Profile) => {
    if (!actor) return false;
    if (actor.id === target.id) return false; // never self
    if (actor.role === 'admin') return true;  // admins can change anyone
    // moderators: only user accounts (not mods/admins)
    return actor.role === 'moderator' && target.role === 'user';
  };

  // Fetch tab data
  useEffect(() => {
    if (!canViewAdmin) return;
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
          const rows = (data || []) as Profile[];
          setUsers(rows);

          // fetch emails via RPC (best-effort)
          const ids = rows.map((u) => u.id);
          if (ids.length) {
            const emails = await fetchEmails(ids);
            setUserEmails(emails);
          } else {
            setUserEmails({});
          }
        } else if (tab === 'offers') {
          const { data } = await supabase
            .from('offers')
            .select('id,title,owner_id,status,created_at')
            .order('created_at', { ascending: false })
            .limit(500);
          const rows = (data || []) as OfferRow[];
          setOffers(rows);

          // owner labels (name + email)
          const ownerIds = Array.from(new Set(rows.map((o) => o.owner_id)));
          if (ownerIds.length) {
            const [namesRes, emailsMap] = await Promise.all([
              supabase.from('profiles').select('id,display_name').in('id', ownerIds),
              fetchEmails(ownerIds),
            ]);
            const nameMap: Record<string, string> = {};
            for (const p of ((namesRes.data || []) as Profile[])) nameMap[p.id] = p.display_name;
            const combined: Record<string, { name: string; email: string | null }> = {};
            for (const id of ownerIds) {
              combined[id] = { name: nameMap[id] ?? id, email: emailsMap[id] ?? null };
            }
            setOwnerInfo(combined);
          } else {
            setOwnerInfo({});
          }
        } else if (tab === 'audit') {
          const { data: rows } = await supabase
            .from('admin_actions')
            .select('id,admin_profile_id,action,target_type,target_id,reason,created_at')
            .order('created_at', { ascending: false })
            .limit(200);

          const acts = (rows || []) as AdminAction[];

          const adminIds = Array.from(new Set(acts.map((a) => a.admin_profile_id)));
          const adminMap = new Map<string, string>();
          if (adminIds.length) {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id,display_name')
              .in('id', adminIds);
            for (const a of ((admins || []) as Profile[])) adminMap.set(a.id, a.display_name);
          }

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
  }, [canViewAdmin, tab]);

  // helper — best-effort email RPC (supports either param name)
  async function fetchEmails(ids: string[]) {
    try {
      // Try common param names one by one
      let res = await supabase.rpc('admin_get_profile_emails', { p_profile_ids: ids });
      if (res.error) res = await supabase.rpc('admin_get_profile_emails', { ids });
      if (res.error) res = await supabase.rpc('admin_get_profile_emails', { p_ids: ids });
      if (res.error) throw res.error;

      const rows = (res.data || []) as EmailRow[];
      const map: Record<string, string | null> = {};
      for (const r of rows) map[r.id] = r.email ?? null;
      return map;
    } catch (err) {
      console.warn('email RPC failed (showing blanks):', err);
      return {} as Record<string, string | null>;
    }
  }

  // title search + pending filter
  const offersVisible = useMemo(() => {
    const base = pendingOnly ? offers.filter((o) => o.status === 'pending') : offers;
    const q = offerQ.trim().toLowerCase();
    if (!q) return base;
    return base.filter((o) => o.title.toLowerCase().includes(q));
  }, [offers, pendingOnly, offerQ]);

  const usersVisible = useMemo(() => users, [users]);

  // ===== Actions =====
  async function setUserStatus(
    id: string,
    targetRole: Role,
    next: Status
  ) {
    if (!me) return;
    // client-side guard: moderators may only change status for regular users
    if (!isAdmin && (me.role === 'moderator') && targetRole !== 'user') {
      setMsg('Only admins can change status for moderators and admins.');
      return;
    }
    if (id === me.id) {
      setMsg("You can't change your own status.");
      return;
    }

    setMsg('');
    const reason = prompt(`Reason for setting status to ${next}? (optional)`) || null;
    try {
      await supabase.rpc('admin_user_set_status', {
        p_profile_id: id,
        p_status: next,
        p_reason: reason,
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: next } : u)));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to set status');
    }
  }

  async function setUserRole(id: string, next: Role) {
    if (!isAdmin) {
      setMsg('Only admins can change roles.');
      return;
    }
    setMsg('');
    try {
      const { error } = await supabase.rpc('admin_set_role', { p_profile: id, p_role: next });
      if (error) throw error;
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role: next } : u)));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to change role');
    }
  }

  async function deleteUser(id: string) {
    if (!isAdmin) {
      setMsg('Only admins can delete users.');
      return;
    }
    if (id === me?.id) {
      setMsg("You can't delete your own account.");
      return;
    }
    const confirmed = confirm('PERMANENTLY delete this member? This cannot be undone.');
    if (!confirmed) return;

    const reason = prompt('Reason (optional):') || null;
    try {
      const { error } = await supabase.rpc('admin_user_delete', { p_profile_id: id, p_reason: reason });
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? 'Failed to delete user');
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

  // Scroll/highlight ?offer=<id>
  useEffect(() => {
    if (tab !== 'offers' || !urlFocusOffer) return;
    const el = offerRowRefs.current.get(urlFocusOffer);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('bg-amber-50');
    const t = setTimeout(() => el.classList.remove('bg-amber-50'), 2500);
    return () => clearTimeout(t);
  }, [tab, urlFocusOffer, offersVisible]);

  if (!me) {
    return (
      <section className="max-w-5xl">
        <p>Loading…</p>
      </section>
    );
  }
  if (!canViewAdmin) {
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
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Role</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Joined</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersVisible.map((u) => {
                const canStatus = canChangeStatus(me, u);
                const commonBtn =
                  'rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
                const tooltip =
                  !canStatus && (me?.role === 'moderator')
                    ? 'Moderators can only change status for regular users.'
                    : !canStatus && (me?.id === u.id)
                    ? "You can't change your own status."
                    : undefined;

                return (
                  <tr key={u.id} className="border-t">
                    <td className="px-3 py-2">{u.display_name}</td>
                    <td className="px-3 py-2">{userEmails[u.id] ?? '—'}</td>
                    <td className="px-3 py-2">{u.role}</td>
                    <td className="px-3 py-2">{u.status}</td>
                    <td className="px-3 py-2">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {u.status === 'active' ? (
                          <button
                            title={tooltip}
                            disabled={!canStatus}
                            onClick={() => setUserStatus(u.id, u.role, 'suspended')}
                            className={commonBtn}
                          >
                            Suspend
                          </button>
                        ) : (
                          <button
                            title={tooltip}
                            disabled={!canStatus}
                            onClick={() => setUserStatus(u.id, u.role, 'active')}
                            className={commonBtn}
                          >
                            Unsuspend
                          </button>
                        )}

                        {/* Role-change controls — admins only */}
                        {isAdmin && (
                          <>
                            {u.role !== 'user' && (
                              <button onClick={() => setUserRole(u.id, 'user')} className={commonBtn}>
                                Demote to user
                              </button>
                            )}
                            {u.role !== 'moderator' && (
                              <button onClick={() => setUserRole(u.id, 'moderator')} className={commonBtn}>
                                Promote to mod
                              </button>
                            )}
                            {u.role !== 'admin' && (
                              <button onClick={() => setUserRole(u.id, 'admin')} className={commonBtn}>
                                Promote to admin
                              </button>
                            )}
                            {u.id !== me.id && (
                              <button onClick={() => deleteUser(u.id)} className={commonBtn}>
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usersVisible.length === 0 && (
                <tr>
                  <td className="px-3 py-4 text-gray-600" colSpan={6}>
                    No users.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'offers' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pendingOnly}
                onChange={(e) => setPendingOnly(e.target.checked)}
              />
              Show pending only
            </label>
            <span className="text-xs text-gray-600">
              {offers.filter((o) => o.status === 'pending').length} pending
            </span>

            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-600">Title</label>
              <input
                value={offerQ}
                onChange={(e) => setOfferQ(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
                placeholder="Filter by title…"
              />
            </div>
          </div>

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
                {offersVisible.map((o) => {
                  const owner = ownerInfo[o.owner_id];
                  return (
                    <tr
                      key={o.id}
                      ref={(el) => {
                        if (el) offerRowRefs.current.set(o.id, el);
                        else offerRowRefs.current.delete(o.id);
                      }}
                      className={`border-t ${urlFocusOffer === o.id ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-3 py-2">{o.title}</td>
                      <td className="px-3 py-2">
                        <div>{owner?.email ? `${owner.name} — ${owner.email}` : owner?.name ?? o.owner_id}</div>
                        {!owner?.email && <div className="text-xs text-gray-500">—</div>}
                      </td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {o.status === 'pending' && (
                            <>
                              <button
                                onClick={() => setOfferStatus(o.id, 'active')}
                                className="rounded border px-2 py-1 hover:bg-gray-50"
                                title="Approve (set Active)"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setOfferStatus(o.id, 'archived')}
                                className="rounded border px-2 py-1 hover:bg-gray-50"
                                title="Reject (archive)"
                              >
                                Reject
                              </button>
                            </>
                          )}
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
                  );
                })}
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
        </div>
      )}

      {tab === 'audit' && (
        <ul className="space-y-3">
          {audit.map((a) => (
            <li key={a.id} className="rounded border p-3 text-sm">
              <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
              <div className="mt-1">
                <span className="font-medium">{a.admin_name || a.admin_profile_id}</span>{' '}
                performed <span className="font-mono">{a.action}</span> on{' '}
                <span className="font-mono">{a.target_type}</span> “{a.target_label || a.target_id}”
                {a.reason ? (
                  <>
                    {' '}— <span className="italic text-gray-700">“{a.reason}”</span>
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
