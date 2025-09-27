'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import ProfileImageUploader from './ProfileImageUploader';

export type ProfileEditable = {
  id: string;
  display_name: string;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  cover_url: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  profile: ProfileEditable;
  onSaved: (p: ProfileEditable) => void;
};

export default function ProfileEditDialog({ open, onClose, profile, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [bio, setBio] = useState(profile.bio ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(profile.cover_url ?? null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setSaving(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          city: city.trim() || null,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        })
        .eq('id', profile.id)
        .select('id,display_name,bio,city,avatar_url,cover_url')
        .single();

      if (error) throw error;
      onSaved(data as ProfileEditable);
      onClose();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Edit Profile</h3>
          <button onClick={onClose} className="rounded border px-2 py-1 text-sm hover:bg-gray-50">Close</button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="Your name"
            />

            <label className="text-sm font-medium">City</label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="City (optional)"
            />

            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="h-28 w-full resize-none rounded border px-3 py-2"
              placeholder="Say hello…"
            />
          </div>

          <div className="space-y-4">
            <ProfileImageUploader
              bucket="covers"
              profileId={profile.id}
              label="Cover photo"
              currentUrl={coverUrl}
              onUploaded={setCoverUrl}
            />
            <ProfileImageUploader
              bucket="avatars"
              profileId={profile.id}
              label="Profile picture"
              currentUrl={avatarUrl}
              onUploaded={setAvatarUrl}
            />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-rose-700">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded bg-gray-900 px-3 py-2 text-sm text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
