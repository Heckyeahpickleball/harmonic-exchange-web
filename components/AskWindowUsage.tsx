'use client';

export default function AskWindowUsage({
  used,
  limit,
  loading = false,
  error,
}: {
  used?: number | null;
  limit?: number | null;
  loading?: boolean;
  error?: string | null;
}) {
  if (error) return <span className="text-xs text-red-600">quota err</span>;

  const isNumber = (val: unknown): val is number => typeof val === 'number' && Number.isFinite(val);

  const resolvedUsed = isNumber(used) ? used : null;
  const resolvedLimit = isNumber(limit) ? limit : null;

  if (loading || resolvedUsed === null || resolvedLimit === null) {
    return <span className="text-xs text-gray-500">…</span>;
  }

  return (
    <span className="text-xs text-gray-700">
      Asks used (last 30 days): <b>{resolvedUsed}/{resolvedLimit}</b>
    </span>
  );
}
