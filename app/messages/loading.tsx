// app/messages/loading.tsx
export default function MessagesLoading() {
  return (
    <section className="md:flex md:gap-4">
      <aside className="w-full md:w-80 shrink-0 md:border-r md:pr-2">
        <div className="mb-2 flex items-center justify-between md:mb-3">
          <h2 className="text-xl font-bold">Messages</h2>
          <span className="hidden text-xs text-gray-500 md:block">Loading…</span>
        </div>
        <ul className="divide-y rounded border md:border-0">
          <li className="px-3 py-3 text-sm text-gray-600">Loading conversations…</li>
          <li className="px-3 py-3 text-sm text-gray-400">…</li>
          <li className="px-3 py-3 text-sm text-gray-400">…</li>
        </ul>
      </aside>
      <div className="flex-1">
        <div className="rounded border p-6 text-sm text-gray-600">Preparing chat…</div>
      </div>
    </section>
  );
}
