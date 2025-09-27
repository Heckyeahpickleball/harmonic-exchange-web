// /app/profile/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileRow = {
  id: string;
  display_name: string;
  area_city: string | null;
  area_country: string | null;
  skills: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  role?: 'user' | 'moderator' | 'admin';
  status?: 'active' | 'suspended';
  created_at?: string;
};

type FormState = {
  display_name: string;
  area_city: string;
  area_country: string;
  skillsCSV: string; // comma-separated
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
};

export default function ProfilePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string>('');

  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [form, setForm] = useState<FormState>({
    display_name: '',
    area_city: '',
    area_country: '',
    skillsCSV: '',
    bio: '',
    avatar_url: null,
    cover_url: null,
  });

  // Load current user + profile
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setStatus('');

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userRes.user) {
        setLoading(false);
        return;
      }
      const u = userRes.user;
      if (cancelled) return;
      setUserEmail(u.email ?? u.phone ?? null);
      setUserId(u.id);

      // Fetch profile row
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('id, display_name, area_city, area_country, skills, bio, avatar_url, cover_url, role, status, created_at')
        .eq('id', u.id)
        .single();

      if (profErr) {
        setStatus(`Heads up: profile not found yet. Try Sign Out then Sign In again to create it. (${profErr.message})`);
        setLoading(false);
        return;
      }

      const p = (prof as ProfileRow) ?? null;
      setProfile(p);

      setForm({
        display_name: p?.display_name ?? '',
        area_city: p?.area_city ?? '',
        area_country: p?.area_country ?? '',
        skillsCSV: Array.isArray(p?.skills) ? p!.skills!.join(', ') : '',
        bio: p?.bio ?? '',
        avatar_url: p?.avatar_url ?? null,
        cover_url: p?.cover_url ?? null,
      });

      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const skillsList = useMemo(
    () =>
      (form.skillsCSV || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [form.skillsCSV]
  );

  async function uploadTo(bucket: 'avatars' | 'covers', file: File): Promise<string> {
    if (!userId) throw new Error('Not signed in');
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });
    if (upErr) throw upErr;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    const display_name = form.display_name.trim();
    if (!display_name) {
      setStatus('Display name is required.');
      return;
    }

    const skills = (form.skillsCSV || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSaving(true);
    setStatus('Saving...');

    const { data, error } = await supabase
      .from('profiles')
      .update({
        display_name,
        area_city: form.area_city.trim() || null,
        area_country: form.area_country.trim() || null,
        bio: form.bio.trim() || null,
        skills, // text[]
        avatar_url: form.avatar_url,
        cover_url: form.cover_url,
      })
      .eq('id', userId)
      .select('id, display_name, area_city, area_country, skills, bio, avatar_url, cover_url, role, status, created_at')
      .single();

    setSaving(false);

    if (error) {
      setStatus(`Save failed: ${error.message}`);
    } else {
      setProfile(data as ProfileRow);
      setStatus('Saved! ✅');
      setEditing(false);
    }
  }

  if (loading) return <p className="p-4">Loading...</p>;

  if (!userEmail) {
    return (
      <section className="max-w-lg space-y-4 p-4">
        <h2 className="text-2xl font-bold">My Profile</h2>
        <p>You are not signed in.</p>
        <a className="underline" href="/sign-in">Go to Sign In</a>
      </section>
    );
  }

  // ----- VIEW MODE -----
  return (
    <section className="space-y-4 p-0 md:p-4">
      {/* Header card */}
      <div className="overflow-hidden rounded-xl border">
        {/* Cover */}
        <div className="relative h-40 w-full md:h-56">
          {form.cover_url ? (
            <img src={form.cover_url} alt="Cover" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
          )}
        </div>

        {/* Header content */}
        <div className="relative px-4 pb-4 pt-12 md:px-6">
          {/* Avatar */}
          <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white md:left-6 md:h-24 md:w-24">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">☺</div>
            )}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="mt-2 md:mt-0 md:pl-24">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold md:text-2xl">
                  {form.display_name || 'Unnamed'}
                </h1>
                {profile?.role && (
                  <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                    {profile.role}
                  </span>
                )}
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {form.area_city || form.area_country ? (
                  <span>
                    {[form.area_city, form.area_country].filter(Boolean).join(', ')}
                  </span>
                ) : (
                  <span>—</span>
                )}
                {profile?.created_at && (
                  <>
                    <span className="mx-2">•</span>
                    <span>Member since {new Date(profile.created_at).toLocaleDateString()}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 md:self-center">
              <button
                onClick={() => setEditing(true)}
                className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                Edit Profile
              </button>
              <button
                type="button"
                onClick={async () => { await supabase.auth.signOut(); location.href='/' }}
                className="rounded border px-3 py-2 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* About / Skills */}
      {(form.bio || skillsList.length) && (
        <div className="rounded-xl border p-4">
          {form.bio && (
            <>
              <h3 className="mb-1 text-sm font-semibold">About</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-800">{form.bio}</p>
            </>
          )}

          {skillsList.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-sm font-semibold">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skillsList.map((s, i) => (
                  <span key={i} className="rounded-full border px-2 py-1 text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {status && <p className="px-1 text-sm text-gray-700">{status}</p>}

      {/* ----- EDIT DIALOG (inline, no extra files) ----- */}
      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Profile</h3>
              <button onClick={() => setEditing(false)} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">
                Close
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSave(e);
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium">Display name *</label>
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="e.g., Sara W."
                    required
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium">City</label>
                    <input
                      className="mt-1 w-full rounded border p-2"
                      value={form.area_city}
                      onChange={(e) => setForm({ ...form, area_city: e.target.value })}
                      placeholder="Ottawa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Country</label>
                    <input
                      className="mt-1 w-full rounded border p-2"
                      value={form.area_country}
                      onChange={(e) => setForm({ ...form, area_country: e.target.value })}
                      placeholder="Canada"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium">Skills (comma-separated)</label>
                  <input
                    className="mt-1 w-full rounded border p-2"
                    value={form.skillsCSV}
                    onChange={(e) => setForm({ ...form, skillsCSV: e.target.value })}
                    placeholder="coaching, event planning, web design"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium">Short bio</label>
                  <textarea
                    className="mt-1 w-full rounded border p-2"
                    rows={5}
                    value={form.bio}
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    placeholder="What you care about and want to gift to the community..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cover photo</label>
                  {form.cover_url ? (
                    <img src={form.cover_url} alt="Cover" className="max-h-40 w-full rounded border object-cover" />
                  ) : (
                    <div className="rounded border p-4 text-sm text-gray-500">No cover set</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setStatus('Uploading cover…');
                      try {
                        const url = await uploadTo('covers', file);
                        setForm((f) => ({ ...f, cover_url: url }));
                        setStatus('Cover uploaded');
                      } catch (err: any) {
                        setStatus(`Cover upload failed: ${err?.message ?? err}`);
                      } finally {
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Profile picture</label>
                  {form.avatar_url ? (
                    <img src={form.avatar_url} alt="Avatar" className="h-32 w-32 rounded-full border object-cover" />
                  ) : (
                    <div className="grid h-32 w-32 place-items-center rounded-full border text-sm text-gray-500">
                      No avatar
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setStatus('Uploading avatar…');
                      try {
                        const url = await uploadTo('avatars', file);
                        setForm((f) => ({ ...f, avatar_url: url }));
                        setStatus('Avatar uploaded');
                      } catch (err: any) {
                        setStatus(`Avatar upload failed: ${err?.message ?? err}`);
                      } finally {
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              </div>

              <div className="md:col-span-2 mt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded border px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </form>

            {status && <p className="mt-3 text-sm text-gray-700">{status}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
