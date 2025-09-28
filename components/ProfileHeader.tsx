// /components/ProfileHeader.tsx
'use client';

type Props = {
  displayName: string;
  city?: string | null;            // pass "City, Country" combined if you like
  role?: 'user' | 'moderator' | 'admin';
  memberSince?: string;            // ISO date
  avatarUrl?: string | null;
  coverUrl?: string | null;
  canEdit?: boolean;
  onEdit?: () => void;
};

export default function ProfileHeader({
  displayName,
  city,
  role,
  memberSince,
  avatarUrl,
  coverUrl,
  canEdit,
  onEdit,
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border">
      {/* Cover */}
      <div className="relative h-40 w-full md:h-56">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="Cover" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-slate-200 to-slate-100" />
        )}
      </div>

      {/* Header content */}
      <div className="relative px-4 pb-4 pt-12 md:px-6">
        {/* Avatar */}
        <div className="absolute -top-10 left-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white md:left-6 md:h-24 md:w-24">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-slate-200 text-slate-500">☺</div>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="mt-2 md:mt-0 md:pl-24">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold md:text-2xl">
                {displayName || 'Unnamed'}
              </h1>
              {role && (
                <span className="rounded-full border px-2 py-0.5 text-xs capitalize text-gray-700">
                  {role}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {city ? <span>{city}</span> : <span>—</span>}
              {memberSince && (
                <>
                  <span className="mx-2">•</span>
                  <span>Member since {new Date(memberSince).toLocaleDateString()}</span>
                </>
              )}
            </div>
          </div>

          {canEdit && (
            <button
              onClick={onEdit}
              className="self-start rounded border px-3 py-2 text-sm hover:bg-gray-50 md:self-center"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
