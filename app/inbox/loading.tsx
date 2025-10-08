// File: app/inbox/loading.tsx
export default function InboxLoading() {
  return (
    <section className="max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Inbox</h2>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded bg-gray-200" />
          <div className="h-9 w-20 rounded bg-gray-200" />
        </div>
      </div>
      <ul className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="rounded border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="h-3 w-36 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-64 rounded bg-gray-200" />
                <div className="mt-2 h-16 w-full rounded bg-gray-100" />
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <div className="h-8 w-24 rounded bg-gray-200" />
                <div className="h-8 w-24 rounded bg-gray-200" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
