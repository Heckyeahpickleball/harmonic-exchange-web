'use client';

import Link from 'next/link';

export default function ProfileLink({
  id,
  name,
  className,
  children,
}: {
  id?: string | null;
  name?: string | null;
  className?: string;
  children?: React.ReactNode; // allow custom content (e.g., avatar + name)
}) {
  const label = children ?? (name ?? 'Someone');
  if (!id) return <span className={className}>{label}</span>;
  return (
    <Link href={`/u/${id}`} className={className}>
      {label}
    </Link>
  );
}
