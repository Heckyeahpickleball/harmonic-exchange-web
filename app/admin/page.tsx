/* HX v0.9 — Admin panel with emails + delete + owner labels + offer title search
   Tightened permissions:
   - Audit tab visible to admins only
   - Moderators cannot act on admin-owned offers (UI + client guard)
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
  target_type: 'profile' | 'offer';
  target_id: string;
  reason: string | null;
  created_at: string;
  admin_name?: string;
  target_label?: string;
};

type EmailRow = { id: string; email: string | null; display_name?: string };

type Tab = 'users' | 'offers' | 'audit';

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-600">Loading…</div>}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const sp = useSearchParams();
  const initialUrlTab = (sp.get('tab') as Tab | null) || null;
  const urlPendingOnly = sp.get('pending') === '1';
  const urlFocusOffer = sp.get('offer');

  const [me, setMe] = useState<Profile | null>(null);
  const [tab, setTab] = useState<Tab>(initialUrlTab ?? 'users');
  const [pendingOnly, setPendingOnly] = useState<boolean>(urlPendingOnly);

  const [offerQ, setOfferQ] = useState('');

  const [users, setUsers] = useState<Profile[]>([]);
  const [userEmails, setUserEmails] = useState<Record<string, string | null>>({});

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const ownerRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  // include owner ROLE so we can gate moderator actions on admin-owned offers
  const [ownerInfo, setOwnerInfo] = useState<
    Record<string, { name: string; email: string | null; role: Role | undefined }>
  >({});

  const [audit, setAudit] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Load current user
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setMe(null);
        // force to users tab for safety
        if (tab !== 'users') setTab('users');
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('id,display_name,role,status,created_at')
        .eq('id', uid)
        .single();
      const meRow = (data || null) as Profile | null;
      setMe(meRow);

      // if a moderator tries to open ?tab=audit, snap back to users
      if (meRow && meRow.role !== 'admin' && (initialUrlTab === 'audit' || tab === 'audit')) {
        setTab('users');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = me?.role === 'admin';
  const canViewAdmin = !!me && (me.role === 'admin' || me.role === 'moderator');

  // client guard for user status changes
  const canChangeUserStatus = (actor: Profile | null, target: Profile) => {
    if (!actor) return false;
    if (actor.id === target.id) return false; // never self
    if (actor.role === 'admin') return true;  // admins can change anyone
    return actor.role === 'moderator' && target.role === 'user';
  };

  // client guard for offer actions
  const canActOnOffer = (actor: Profile | null, ownerRole: Role | undefined) => {
    if (!actor) return false;
    if (actor.role === 'admin') return true;
    // moderators may NOT act on admin-owned offers
    if (actor.role === 'moderator') return ownerRole !== 'admin';
    return false;
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

          const ids = rows.map((u) => u.id);
          setUserEmails(ids.length ? await fetchEmails(ids) : {});
        }

        if (tab === 'offers') {
          const { data } = await supabase
            .from('offers')
            .select('id,title,owner_id,status,created_at')
            .order('created_at', { ascending: false })
            .limit(500);

          const rows = (data || []) as OfferRow[];
          setOffers(rows);

          const ownerIds = Array.from(new Set(rows.map((o) => o.owner_id)));
          if (ownerIds.length) {
            const [profilesRes, emailsMap] = await Promise.all([
              supabase.from('profiles').select('id,display_name,role').in('id', ownerIds),
              fetchEmails(ownerIds),
            ]);

            const combined: Record<string, { name: string; email: string | null; role: Role | undefined }> = {};
            for (const p of ((profilesRes.data || []) as Array<{ id: string; display_name: string; role: Role }>)) {
              combined[p.id] = { name: p.display_name, email: emailsMap[p.id] ?? null, role: p.role };
            }
            // ensure every id has an entry
            for (const id of ownerIds) {
              if (!combined[id]) combined[id] = { name: id, email: emailsMap[id] ?? null, role: undefined };
            }
            setOwnerInfo(combined);
          } else {
            setOwnerInfo({});
          }
        }

        if (tab === 'audit') {
          if (!isAdmin) {
            // double-guard: mods can’t load audit even if they somehow land here
            setTab('users');
            return;
          }

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
  }, [canViewAdmin, tab, isAdmin]);

  // helper — best-effort email RPC
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
  async function setUserStatus(id: string, targetRole: Role, next: Status) {
    if (!me) return;

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
    if (!me) return;

    // find owner role for this offer
    const ownerRole = ownerInfo[offers.find((o) => o.id === id)?.owner_id || '']?.role;

    if (!canActOnOffer(me, ownerRole)) {
      setMsg('Only admins can act on offers owned by admins.');
      return;
    }

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
    const el = ownerRowRefs.current.get(urlFocusOffer);
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
          {(['users', 'offers'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded border px-3 py-1 text-sm ${tab === t ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setTab('audit')}
              className={`rounded border px-3 py-1 text-sm ${tab === 'audit' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
            >
              Audit
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {/* USERS TAB */}
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
                const canStatus = canChangeUserStatus(me, u);
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

      {/* OFFERS TAB */}
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
                  const ownerRole = owner?.role;
                  const allow = canActOnOffer(me, ownerRole);
                  const btn =
                    'rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

                  return (
                    <tr
                      key={o.id}
                      ref={(el) => {
                        if (el) ownerRowRefs.current.set(o.id, el);
                        else ownerRowRefs.current.delete(o.id);
                      }}
                      className={`border-t ${urlFocusOffer === o.id ? 'bg-amber-50' : ''}`}
                    >
                      <td className="px-3 py-2">{o.title}</td>
                      <td className="px-3 py-2">
                        <div>
                          {owner?.email ? `${owner.name} — ${owner.email}` : owner?.name ?? o.owner_id}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ownerRole ? `role: ${ownerRole}` : 'role: —'}
                        </div>
                      </td>
                      <td className="px-3 py-2">{o.status}</td>
                      <td className="px-3 py-2">{new Date(o.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {/* Action buttons are disabled when moderator targets admin-owned offer */}
                          {o.status === 'pending' && (
                            <>
                              <button
                                disabled={!allow}
                                title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                                onClick={() => setOfferStatus(o.id, 'active')}
                                className={btn}
                              >
                                Approve
                              </button>
                              <button
                                disabled={!allow}
                                title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                                onClick={() => setOfferStatus(o.id, 'archived')}
                                className={btn}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {o.status !== 'blocked' ? (
                            <button
                              disabled={!allow}
                              title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                              onClick={() => setOfferStatus(o.id, 'blocked')}
                              className={btn}
                            >
                              Block
                            </button>
                          ) : (
                            <button
                              disabled={!allow}
                              title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                              onClick={() => setOfferStatus(o.id, 'active')}
                              className={btn}
                            >
                              Unblock
                            </button>
                          )}

                          {o.status !== 'paused' && (
                            <button
                              disabled={!allow}
                              title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                              onClick={() => setOfferStatus(o.id, 'paused')}
                              className={btn}
                            >
                              Pause
                            </button>
                          )}

                          {o.status !== 'archived' && (
                            <button
                              disabled={!allow}
                              title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                              onClick={() => setOfferStatus(o.id, 'archived')}
                              className={btn}
                            >
                              Archive
                            </button>
                          )}

                          {o.status !== 'active' && (
                            <button
                              disabled={!allow}
                              title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                              onClick={() => setOfferStatus(o.id, 'active')}
                              className={btn}
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

      {/* AUDIT TAB — admins only */}
      {tab === 'audit' && isAdmin && (
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
