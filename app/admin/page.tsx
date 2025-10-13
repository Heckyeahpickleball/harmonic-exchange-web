/* HX v1.2.1 — Admin panel (Users, Offers, Chapters, Audit) — Mobile friendly
   UI changes (no logic changes):
   - Mobile-first responsive cards for Users / Offers / Chapters.
   - Desktop keeps tables; headers are sticky; cell padding tightened.
   - Actions grouped & wrapped; buttons use compact sizes on mobile.
   - Preserves all RPC fallbacks and permissions logic.

   Notes:
   - Nothing else in the app needs to change.
   - All original behavior retained; just different rendering below md.
*/

'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ResetQuotaButton from '@/components/ResetQuotaButton';
import AskWindowUsage from '@/components/AskWindowUsage';

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
  target_type: 'profile' | 'offer' | 'group';
  target_id: string;
  reason: string | null;
  created_at: string;
  admin_name?: string;
  target_label?: string;
};

type GroupStatus = 'pending' | 'active' | 'suspended' | 'archived';
type GroupRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  country: string | null;
  status: GroupStatus | null;
  created_by: string | null;
  created_at: string;
  about?: string | null;
};

type EmailRow = { id: string; email: string | null; display_name?: string };

type Tab = 'users' | 'offers' | 'chapters' | 'audit';

/** Small component to show "Fulfilled received" (view created in SQL) */
function FulfilledCount({ profileId }: { profileId: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profile_received_fulfillments')
          .select('fulfilled_received')
          .eq('profile_id', profileId)
          .maybeSingle();
        if (!cancel) {
          if (error) throw error;
          setCount((data?.fulfilled_received as number | undefined) ?? 0);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? 'err');
      }
    })();
    return () => { cancel = true; };
  }, [profileId]);

  if (error) return <span className="text-xs text-red-600">count err</span>;
  if (count === null) return <span className="text-xs text-gray-500">…</span>;
  return <span className="text-xs text-gray-700">Fulfilled received: <b>{count}</b></span>;
}

/** Row-level wrapper so each user row can refresh its 30d usage after a reset */
function RowAskControls({ profileId }: { profileId: string }) {
  const [refreshToken, setRefreshToken] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <FulfilledCount profileId={profileId} />
      <AskWindowUsage profileId={profileId} refreshToken={refreshToken} />
      <ResetQuotaButton profileId={profileId} onSuccess={() => setRefreshToken((n) => n + 1)} />
    </div>
  );
}

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

  const [userQ, setUserQ] = useState(''); // users search query

  const [users, setUsers] = useState<Profile[]>([]);
  const [userEmails, setUserEmails] = useState<Record<string, string | null>>({});

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const ownerRowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [ownerInfo, setOwnerInfo] = useState<
    Record<string, { name: string; email: string | null; role: Role | undefined }>
  >({});

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupQ, setGroupQ] = useState('');
  const [groupFilter, setGroupFilter] = useState<'pending' | 'active' | 'suspended' | 'archived' | 'all'>('pending');

  const [audit, setAudit] = useState<AdminAction[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Small helper to surface useful errors
  function showError(e: any, fallback = 'Something went wrong.') {
    const m =
      e?.message ||
      e?.error?.message ||
      e?.details ||
      (typeof e === 'string' ? e : '') ||
      JSON.stringify(e || {}, null, 2) ||
      fallback;
    setMsg(m);
    console.error(e);
  }

  // Load current user
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setMe(null);
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

      if (meRow && meRow.role !== 'admin' && (initialUrlTab === 'audit' || tab === 'audit')) {
        setTab('users');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = me?.role === 'admin';
  const canViewAdmin = !!me && (me.role === 'admin' || me.role === 'moderator');

  const canChangeUserStatus = (actor: Profile | null, target: Profile) => {
    if (!actor) return false;
    if (actor.id === target.id) return false;
    if (actor.role === 'admin') return true;
    return actor.role === 'moderator' && target.role === 'user';
  };

  const canActOnOffer = (actor: Profile | null, ownerRole: Role | undefined) => {
    if (!actor) return false;
    if (actor.role === 'admin') return true;
    if (actor.role === 'moderator') return ownerRole !== 'admin';
    return false;
  };

  // ===== Fetch tab data =====
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
            for (const id of ownerIds) {
              if (!combined[id]) combined[id] = { name: id, email: emailsMap[id] ?? null, role: undefined };
            }
            setOwnerInfo(combined);
          } else {
            setOwnerInfo({});
          }
        }

        if (tab === 'chapters') {
          const { data, error } = await supabase
            .from('groups')
            .select('id,name,slug,city,country,status,created_by,created_at,about')
            .order('created_at', { ascending: false })
            .limit(300);

          if (error) throw error;
          setGroups((data || []) as GroupRow[]);
        }

        if (tab === 'audit') {
          if (!isAdmin) { setTab('users'); return; }

          const { data: rows } = await supabase
            .from('admin_actions')
            .select('id,admin_profile_id,action,target_type,target_id,reason,created_at')
            .order('created_at', { ascending: false })
            .limit(200);

          const acts = (rows || []) as AdminAction[];
          const adminIds = Array.from(new Set(acts.map((a) => a.admin_profile_id)));

          // map admin id -> name
          const adminMap = new Map<string, string>();
          if (adminIds.length) {
            const { data: admins } = await supabase
              .from('profiles')
              .select('id,display_name')
              .in('id', adminIds);
            for (const a of ((admins || []) as Profile[])) adminMap.set(a.id, a.display_name);
          }

          // collect target ids by type
          const profileTargets = acts.filter((a) => a.target_type === 'profile').map((a) => a.target_id);
          const offerTargets   = acts.filter((a) => a.target_type === 'offer').map((a) => a.target_id);
          const groupTargets   = acts.filter((a) => a.target_type === 'group').map((a) => a.target_id);

          // fetch label sources
          const [profileRows, offerRows, groupRows] = await Promise.all([
            profileTargets.length
              ? supabase.from('profiles').select('id,display_name').in('id', profileTargets)
              : Promise.resolve({ data: [] as any[] }),
            offerTargets.length
              ? supabase.from('offers').select('id,title').in('id', offerTargets)
              : Promise.resolve({ data: [] as any[] }),
            groupTargets.length
              ? supabase.from('groups').select('id,name,city,country,slug').in('id', groupTargets)
              : Promise.resolve({ data: [] as any[] }),
          ]);

          const profMap  = new Map<string, string>();
          const offerMap = new Map<string, string>();
          const groupMap = new Map<string, string>();

          for (const p of ((profileRows as any).data || []) as any[]) profMap.set(p.id, p.display_name);
          for (const o of ((offerRows   as any).data || []) as any[]) offerMap.set(o.id, o.title);

          // Prefer human label for chapters
          for (const g of ((groupRows   as any).data || []) as any[]) {
            const cityCountry = (g.city && g.country) ? `${g.city}, ${g.country}` : null;
            const label = cityCountry || g.name || g.id;
            groupMap.set(g.id, label);
          }

          setAudit(
            acts.map((a) => ({
              ...a,
              admin_name: adminMap.get(a.admin_profile_id) || a.admin_profile_id,
              target_label:
                a.target_type === 'profile' ? (profMap.get(a.target_id) || a.target_id) :
                a.target_type === 'offer'   ? (offerMap.get(a.target_id) || a.target_id) :
                a.target_type === 'group'   ? (groupMap.get(a.target_id) || a.target_id) : a.target_id
            }))
          );
        }

      } catch (e: any) {
        showError(e, 'Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    })();
  }, [canViewAdmin, tab, isAdmin]);

  // helper — best-effort email RPC
  async function fetchEmails(ids: string[]) {
    try {
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

  const offersVisible = useMemo(() => {
    const base = pendingOnly ? offers.filter((o) => o.status === 'pending') : offers;
    const q = offerQ.trim().toLowerCase();
    if (!q) return base;
    return base.filter((o) => o.title.toLowerCase().includes(q));
  }, [offers, pendingOnly, offerQ]);

  // usersVisible filters by display_name, email, or role using userQ
  const usersVisible = useMemo(() => {
    const q = userQ.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = (u.display_name || '').toLowerCase();
      const email = (userEmails[u.id] || '').toLowerCase();
      const role = (u.role || '').toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        role.includes(q)
      );
    });
  }, [users, userEmails, userQ]);

  const groupsVisible = useMemo(() => {
    let rows = groups;
    if (groupFilter !== 'all') rows = rows.filter((g) => (g.status || 'pending') === groupFilter);
    const q = groupQ.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((g) => {
      const label = `${g.name} ${g.city ?? ''} ${g.country ?? ''} ${g.slug ?? ''}`.toLowerCase();
      return label.includes(q);
    });
  }, [groups, groupFilter, groupQ]);

  // ===== User actions =====
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
      showError(e, 'Failed to set status');
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
      showError(e, 'Failed to change role');
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
      showError(e, 'Failed to delete user');
    }
  }

  // ===== Offer actions (with admin-only Delete; RPC with direct update/delete fallback) =====
  async function setOfferStatus(id: string, next: OfferRow['status']) {
    if (!me) return;

    const ownerRole = ownerInfo[offers.find((o) => o.id === id)?.owner_id || '']?.role;

    if (!canActOnOffer(me, ownerRole)) {
      setMsg('Only admins can act on offers owned by admins.');
      return;
    }

    setMsg('');
    const reason = prompt(`Reason for setting offer status to ${next}? (optional)`) || null;

    try {
      // Try RPC first
      const rpc = await supabase.rpc('admin_offer_set_status', {
        p_offer_id: id,
        p_status: next,
        p_reason: reason,
      });

      // Fallback to direct update if RPC fails
      if (rpc.error) {
        const { error: upErr } = await supabase
          .from('offers')
          .update({ status: next })
          .eq('id', id);

        if (upErr) {
          if (/permission denied|row-level security/i.test(upErr.message)) {
            throw new Error(
              "RLS blocked this update. Your admin/mod policy for the 'offers' table is missing or too strict."
            );
          }
          throw upErr;
        }

        // Best-effort: log admin action
        try {
          await supabase.from('admin_actions').insert({
            admin_profile_id: me?.id,
            action: `offers.status -> ${next}`,
            target_type: 'offer',
            target_id: id,
            reason,
          });
        } catch { /* non-blocking */ }
      }

      setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, status: next } : o)));
    } catch (e: any) {
      showError(e, 'Failed to set offer status');
    }
  }

  // NEW: hard delete an offer (admin-only). RPC first, then direct delete fallback.
  async function deleteOffer(id: string) {
    if (!isAdmin) {
      setMsg('Only admins can delete offers.');
      return;
    }
    const confirmed = confirm('PERMANENTLY delete this offer? This cannot be undone.');
    if (!confirmed) return;

    const reason = prompt('Reason (optional):') || null;

    try {
      // Try RPC
      const rpc = await supabase.rpc('admin_offer_delete', {
        p_offer_id: id,
        p_reason: reason,
      });

      if (rpc.error && !/function .* does not exist/i.test(rpc.error.message || '')) {
        throw rpc.error;
      }

      if (rpc.error) {
        // Fallback: direct delete (requires appropriate RLS)
        const { error: delErr } = await supabase.from('offers').delete().eq('id', id);
        if (delErr) {
          if (/permission denied|row-level security/i.test(delErr.message)) {
            throw new Error(
              "RLS blocked this delete. Your admin policy for the 'offers' table is missing or too strict."
            );
          }
          throw delErr;
        }

        // Best-effort audit log
        try {
          await supabase.from('admin_actions').insert({
            admin_profile_id: me?.id,
            action: 'offers.delete',
            target_type: 'offer',
            target_id: id,
            reason,
          });
        } catch { /* non-blocking */ }
      }

      // Remove from UI
      setOffers((prev) => prev.filter((o) => o.id !== id));
    } catch (e: any) {
      showError(e, 'Failed to delete offer');
    }
  }

  // ===== Chapter actions (includes deleteGroup) =====
  function ensureAdminAction() {
    if (!isAdmin) {
      setMsg('Only admins can approve/decline chapters.');
      return false;
    }
    return true;
  }

  async function setGroupStatus(id: string, next: GroupStatus) {
    if (!ensureAdminAction()) return;
    setMsg('');
    const reason = prompt(`Reason for setting chapter status to ${next}? (optional)`) || null;

    try {
      // Try RPC first
      const rpc = await supabase.rpc('admin_group_set_status', {
        p_group_id: id,
        p_status: next,
        p_reason: reason,
      });
      if (rpc.error && !/function .* does not exist/i.test(rpc.error.message || '')) {
        throw rpc.error;
      }
      if (!rpc.error) {
        setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: next } : g)));
        return;
      }

      // Fallback: direct update (requires RLS)
      const { error } = await supabase.from('groups').update({ status: next }).eq('id', id);
      if (error) throw error;

      setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, status: next } : g)));

      // Optional: log admin action
      try {
        await supabase.from('admin_actions').insert({
          admin_profile_id: me?.id,
          action: `groups.status -> ${next}`,
          target_type: 'group',
          target_id: id,
          reason,
        });
      } catch { /* non-blocking */ }
    } catch (e: any) {
      showError(e, 'Failed to update chapter');
    }
  }

  // hard delete a chapter (admin-only). RPC first, then direct delete fallback.
  async function deleteGroup(id: string) {
    if (!isAdmin) {
      setMsg('Only admins can delete chapters.');
      return;
    }
    const confirmed = confirm('PERMANENTLY delete this chapter? This cannot be undone.');
    if (!confirmed) return;

    const reason = prompt('Reason (optional):') || null;

    try {
      // Try RPC
      const rpc = await supabase.rpc('admin_group_delete', {
        p_group_id: id,
        p_reason: reason,
      });

      if (rpc.error && !/function .* does not exist/i.test(rpc.error.message || '')) {
        throw rpc.error;
      }

      if (rpc.error) {
        // Fallback: direct delete (requires appropriate RLS)
        const { error: delErr } = await supabase.from('groups').delete().eq('id', id);
        if (delErr) {
          if (/permission denied|row-level security/i.test(delErr.message)) {
            throw new Error(
              "RLS blocked this delete. Your admin policy for the 'groups' table is missing or too strict."
            );
          }
          throw delErr;
        }

        // Best-effort audit log
        try {
          await supabase.from('admin_actions').insert({
            admin_profile_id: me?.id,
            action: 'groups.delete',
            target_type: 'group',
            target_id: id,
            reason,
          });
        } catch { /* non-blocking */ }
      }

      // Remove from UI
      setGroups((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      showError(e, 'Failed to delete chapter');
    }
  }

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
    return <section className="max-w-5xl px-3 sm:px-4"><p>Loading…</p></section>;
  }
  if (!canViewAdmin) {
    return (
      <section className="max-w-5xl px-3 sm:px-4">
        <h2 className="text-xl sm:text-2xl font-bold">Admin</h2>
        <p>You don’t have access.</p>
      </section>
    );
  }

  const TAB_BTN = (active: boolean) =>
    `rounded border px-3 py-1 text-sm sm:text-[13px] ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`;

  const ACTION_BTN =
    'rounded border px-2 py-1 text-xs sm:text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <section className="max-w-5xl px-2 sm:px-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">Admin</h2>
        <div className="flex gap-2">
          {(['users', 'offers', 'chapters'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={TAB_BTN(tab === t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => setTab('audit')} className={TAB_BTN(tab === 'audit')}>
              Audit
            </button>
          )}
        </div>
      </div>

      {msg && <p className="text-sm text-amber-700 whitespace-pre-wrap">{msg}</p>}
      {loading && <p className="text-sm text-gray-600">Loading…</p>}

      {/* USERS TAB */}
      {tab === 'users' && (
        <div className="space-y-3">
          {/* Users search (name / email / role) */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Search</label>
            <input
              value={userQ}
              onChange={(e) => setUserQ(e.target.value)}
              className="rounded border px-2 py-1 text-sm w-full max-w-xs"
              placeholder="Name, email, or role…"
            />
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2">
            {usersVisible.map((u) => {
              const canStatus = canChangeUserStatus(me, u);
              const tooltip =
                !canStatus && (me?.role === 'moderator')
                  ? 'Moderators can only change status for regular users.'
                  : !canStatus && (me?.id === u.id)
                  ? "You can't change your own status."
                  : undefined;

              return (
                <li key={u.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{u.display_name}</div>
                      <div className="text-xs text-gray-600 truncate">{userEmails[u.id] ?? '—'}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-700">
                        <span className="rounded bg-gray-100 px-2 py-0.5">role: {u.role}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">status: {u.status}</span>
                        <span className="rounded bg-gray-100 px-2 py-0.5">
                          joined: {new Date(u.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      {u.status === 'active' ? (
                        <button
                          title={tooltip}
                          disabled={!canStatus}
                          onClick={() => setUserStatus(u.id, u.role, 'suspended')}
                          className={ACTION_BTN}
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          title={tooltip}
                          disabled={!canStatus}
                          onClick={() => setUserStatus(u.id, u.role, 'active')}
                          className={ACTION_BTN}
                        >
                          Unsuspend
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Admin-only role buttons */}
                  {isAdmin && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {u.role !== 'user' && (
                        <button onClick={() => setUserRole(u.id, 'user')} className={ACTION_BTN}>
                          Demote → user
                        </button>
                      )}
                      {u.role !== 'moderator' && (
                        <button onClick={() => setUserRole(u.id, 'moderator')} className={ACTION_BTN}>
                          Promote → mod
                        </button>
                      )}
                      {u.role !== 'admin' && (
                        <button onClick={() => setUserRole(u.id, 'admin')} className={ACTION_BTN}>
                          Promote → admin
                        </button>
                      )}
                      {u.id !== me.id && (
                        <button onClick={() => deleteUser(u.id)} className={ACTION_BTN}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}

                  {/* Counters + Reset */}
                  <div className="mt-2">
                    <RowAskControls profileId={u.id} />
                  </div>
                </li>
              );
            })}
            {usersVisible.length === 0 && <p className="text-sm text-gray-600">No users.</p>}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
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
                        <div className="flex flex-col gap-2">
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

                          <RowAskControls profileId={u.id} />
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
        </div>
      )}

      {/* OFFERS TAB */}
      {tab === 'offers' && (
        <div className="space-y-3">
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

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2">
            {offersVisible.map((o) => {
              const owner = ownerInfo[o.owner_id];
              const ownerRole = owner?.role;
              const allow = canActOnOffer(me, ownerRole);

              return (
                <li key={o.id} className={`rounded border p-3 ${urlFocusOffer === o.id ? 'bg-amber-50' : ''}`}>
                  <div className="text-sm font-medium">{o.title}</div>
                  <div className="mt-1 text-xs text-gray-700">
                    <div className="truncate">
                      <span className="text-gray-500">Owner:</span>{' '}
                      {owner?.email ? `${owner.name} — ${owner.email}` : owner?.name ?? o.owner_id}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="rounded bg-gray-100 px-2 py-0.5">status: {o.status}</span>
                      <span className="rounded bg-gray-100 px-2 py-0.5">
                        created: {new Date(o.created_at).toLocaleDateString()}
                      </span>
                      <span className="rounded bg-gray-100 px-2 py-0.5">
                        role: {ownerRole ?? '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {o.status === 'pending' && (
                      <>
                        <button
                          disabled={!allow}
                          title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                          onClick={() => setOfferStatus(o.id, 'active')}
                          className={ACTION_BTN}
                        >
                          Approve
                        </button>
                        <button
                          disabled={!allow}
                          title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                          onClick={() => setOfferStatus(o.id, 'archived')}
                          className={ACTION_BTN}
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
                        className={ACTION_BTN}
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        disabled={!allow}
                        title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                        onClick={() => setOfferStatus(o.id, 'active')}
                        className={ACTION_BTN}
                      >
                        Unblock
                      </button>
                    )}

                    {o.status !== 'paused' && (
                      <button
                        disabled={!allow}
                        title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                        onClick={() => setOfferStatus(o.id, 'paused')}
                        className={ACTION_BTN}
                      >
                        Pause
                      </button>
                    )}

                    {o.status !== 'archived' && (
                      <button
                        disabled={!allow}
                        title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                        onClick={() => setOfferStatus(o.id, 'archived')}
                        className={ACTION_BTN}
                      >
                        Archive
                      </button>
                    )}

                    {o.status !== 'active' && (
                      <button
                        disabled={!allow}
                        title={!allow ? 'Only admins can act on admin-owned offers.' : undefined}
                        onClick={() => setOfferStatus(o.id, 'active')}
                        className={ACTION_BTN}
                      >
                        Set Active
                      </button>
                    )}

                    {/* Admin-only hard delete */}
                    {isAdmin && (
                      <button
                        onClick={() => deleteOffer(o.id)}
                        className={ACTION_BTN}
                        title="Delete offer (admin only)"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {offersVisible.length === 0 && <p className="text-sm text-gray-600">No offers.</p>}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block overflow-auto rounded border">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
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

                          {/* Admin-only hard delete */}
                          {isAdmin && (
                            <button
                              onClick={() => deleteOffer(o.id)}
                              className={btn}
                              title="Delete offer (admin only)"
                            >
                              Delete
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

      {/* CHAPTERS TAB */}
      {tab === 'chapters' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Status</label>
              <select
                className="rounded border px-2 py-1 text-sm"
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value as any)}
              >
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <label className="text-sm text-gray-600">Search</label>
              <input
                value={groupQ}
                onChange={(e) => setGroupQ(e.target.value)}
                className="rounded border px-2 py-1 text-sm"
                placeholder="City / country / name / slug…"
              />
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden space-y-2">
            {groupsVisible.map((g) => {
              const label = g.city && g.country ? `${g.city}, ${g.country}` : g.name;
              return (
                <li key={g.id} className="rounded border p-3">
                  <div className="text-sm font-medium">{label}</div>
                  {g.about ? <div className="text-xs text-gray-600 line-clamp-2 mt-0.5">{g.about}</div> : null}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-700">
                    <span className="rounded bg-gray-100 px-2 py-0.5">slug: {g.slug || '—'}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5">status: {g.status || 'pending'}</span>
                    <span className="rounded bg-gray-100 px-2 py-0.5">
                      created: {new Date(g.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {g.status === 'pending' && (
                      <>
                        <button
                          disabled={!isAdmin}
                          title={!isAdmin ? 'Only admins can approve.' : undefined}
                          onClick={() => setGroupStatus(g.id, 'active')}
                          className={ACTION_BTN}
                        >
                          Approve
                        </button>
                        <button
                          disabled={!isAdmin}
                          title={!isAdmin ? 'Only admins can decline.' : undefined}
                          onClick={() => setGroupStatus(g.id, 'archived')}
                          className={ACTION_BTN}
                        >
                          Decline
                        </button>
                      </>
                    )}

                    {g.status === 'active' && (
                      <>
                        <button
                          disabled={!isAdmin}
                          title={!isAdmin ? 'Only admins can suspend.' : undefined}
                          onClick={() => setGroupStatus(g.id, 'suspended')}
                          className={ACTION_BTN}
                        >
                          Suspend
                        </button>
                        <a
                          className="rounded border px-2 py-1 text-xs sm:text-sm hover:bg-gray-50"
                          href={g.slug ? `/chapters/${g.slug}` : '#'}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View
                        </a>
                      </>
                    )}

                    {g.status === 'suspended' && (
                      <>
                        <button
                          disabled={!isAdmin}
                          title={!isAdmin ? 'Only admins can activate.' : undefined}
                          onClick={() => setGroupStatus(g.id, 'active')}
                          className={ACTION_BTN}
                        >
                          Activate
                        </button>
                        <button
                          disabled={!isAdmin}
                          title={!isAdmin ? 'Only admins can archive.' : undefined}
                          onClick={() => setGroupStatus(g.id, 'archived')}
                          className={ACTION_BTN}
                        >
                          Archive
                        </button>
                      </>
                    )}

                    {g.status === 'archived' && (
                      <button
                        disabled={!isAdmin}
                        title={!isAdmin ? 'Only admins can activate.' : undefined}
                        onClick={() => setGroupStatus(g.id, 'active')}
                        className={ACTION_BTN}
                      >
                        Activate
                      </button>
                    )}

                    {/* Admin-only hard delete — always visible in mobile list */}
                    {isAdmin && (
                      <button
                        disabled={!isAdmin}
                        title={!isAdmin ? 'Only admins can delete.' : undefined}
                        onClick={() => deleteGroup(g.id)}
                        className={ACTION_BTN}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
            {groupsVisible.length === 0 && <p className="text-sm text-gray-600">No chapters.</p>}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block overflow-auto rounded border">
            <table className="min-w-full text-sm table-fixed">
              {/* IMPORTANT: no whitespace or comments inside colgroup */}
              <colgroup><col className="w-[30%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[14%]" /><col className="w-[40%]" /></colgroup>
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left">Chapter</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Created</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupsVisible.map((g) => {
                  const btn =
                    'rounded border px-2 py-1 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed';
                  const label = g.city && g.country ? `${g.city}, ${g.country}` : g.name;

                  return (
                    <tr key={g.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{label}</div>
                        {g.about ? <div className="text-xs text-gray-600 line-clamp-1">{g.about}</div> : null}
                      </td>
                      <td className="px-3 py-2">{g.slug || '—'}</td>
                      <td className="px-3 py-2">{g.status || 'pending'}</td>
                      <td className="px-3 py-2">{new Date(g.created_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          {g.status === 'pending' && (
                            <>
                              <button
                                disabled={!isAdmin}
                                title={!isAdmin ? 'Only admins can approve.' : undefined}
                                onClick={() => setGroupStatus(g.id, 'active')}
                                className={btn}
                              >
                                Approve
                              </button>
                              <button
                                disabled={!isAdmin}
                                title={!isAdmin ? 'Only admins can decline.' : undefined}
                                onClick={() => setGroupStatus(g.id, 'archived')}
                                className={btn}
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {g.status === 'active' && (
                            <>
                              <button
                                disabled={!isAdmin}
                                title={!isAdmin ? 'Only admins can suspend.' : undefined}
                                onClick={() => setGroupStatus(g.id, 'suspended')}
                                className={btn}
                              >
                                Suspend
                              </button>
                              <a
                                className="rounded border px-2 py-1 hover:bg-gray-50"
                                href={g.slug ? `/chapters/${g.slug}` : '#'}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View
                              </a>
                            </>
                          )}

                          {g.status === 'suspended' && (
                            <>
                              <button
                                disabled={!isAdmin}
                                title={!isAdmin ? 'Only admins can activate.' : undefined}
                                onClick={() => setGroupStatus(g.id, 'active')}
                                className={btn}
                              >
                                Activate
                              </button>
                              <button
                                disabled={!isAdmin}
                                title={!isAdmin ? 'Only admins can archive.' : undefined}
                                onClick={() => setGroupStatus(g.id, 'archived')}
                                className={btn}
                              >
                                Archive
                              </button>
                            </>
                          )}

                          {g.status === 'archived' && (
                            <button
                              disabled={!isAdmin}
                              title={!isAdmin ? 'Only admins can activate.' : undefined}
                              onClick={() => setGroupStatus(g.id, 'active')}
                              className={btn}
                            >
                              Activate
                            </button>
                          )}

                          {/* Admin-only hard delete — always visible in desktop table */}
                          {isAdmin && (
                            <button
                              disabled={!isAdmin}
                              title={!isAdmin ? 'Only admins can delete.' : undefined}
                              onClick={() => deleteGroup(g.id)}
                              className={btn}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {groupsVisible.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-gray-600" colSpan={5}>
                      No chapters.
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
